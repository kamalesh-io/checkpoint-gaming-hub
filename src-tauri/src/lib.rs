mod gamepad;
mod launcher;
mod process_manager;

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;

use gamepad::{spawn_native_gamepad_thread, NativeGamepadSnapshot, NativeGamepadState, SharedGamepadState};
use launcher::{launch_executable, launch_steam_game, pick_executable_file, restore_window};
use process_manager::{BackendState, BackendStatus, BackendStatusInfo, LocalApiConfig, ProcessManager, SharedBackendState};

#[tauri::command]
fn get_local_api_config(state: State<'_, SharedBackendState>) -> LocalApiConfig {
    if let Ok(lock) = state.lock() {
        LocalApiConfig {
            base_url: lock.base_url.clone(),
            token: Some(lock.token.clone()),
        }
    } else {
        LocalApiConfig {
            base_url: "http://127.0.0.1:8765/api/v1".to_string(),
            token: None,
        }
    }
}

#[tauri::command]
fn wait_for_backend_ready(
    timeout_ms: Option<u64>,
    state: State<'_, SharedBackendState>,
) -> Result<LocalApiConfig, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(25_000));
    let start = Instant::now();
    loop {
        {
            let lock = state.lock().map_err(|e| e.to_string())?;
            match lock.status {
                BackendStatus::Ready => {
                    return Ok(LocalApiConfig {
                        base_url: lock.base_url.clone(),
                        token: Some(lock.token.clone()),
                    });
                }
                BackendStatus::Error => {
                    return Err(lock.error_message.clone().unwrap_or_else(|| "Failed to start backend".to_string()));
                }
                BackendStatus::Initializing => {
                    // Continue waiting
                }
            }
        }
        if start.elapsed() >= timeout {
            return Err("Timed out waiting for CHECKPOINT backend service to become ready".to_string());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[tauri::command]
fn get_backend_status(state: State<'_, SharedBackendState>) -> BackendStatusInfo {
    if let Ok(lock) = state.lock() {
        let message = match lock.status {
            BackendStatus::Initializing => "Starting local game services...".to_string(),
            BackendStatus::Ready => "Ready".to_string(),
            BackendStatus::Error => lock.error_message.clone().unwrap_or_else(|| "Failed to start backend".to_string()),
        };

        BackendStatusInfo {
            status: lock.status.clone(),
            port: lock.port,
            base_url: lock.base_url.clone(),
            message,
        }
    } else {
        BackendStatusInfo {
            status: BackendStatus::Error,
            port: None,
            base_url: "http://127.0.0.1:8765/api/v1".to_string(),
            message: "Failed to access backend state mutex".to_string(),
        }
    }
}

#[tauri::command]
fn restart_backend(state: State<'_, SharedBackendState>) -> Result<LocalApiConfig, String> {
    let state_arc: SharedBackendState = (*state).clone();

    // 1. Stop existing backend
    ProcessManager::stop_backend(state_arc.clone());

    // 2. Reset state to initializing
    {
        let mut lock = state_arc.lock().map_err(|e| e.to_string())?;
        lock.status = BackendStatus::Initializing;
        lock.error_message = None;
        lock.port = None;
    }

    // 3. Start backend again
    ProcessManager::start_backend(state_arc.clone())?;

    // 4. Return new config
    let lock = state_arc.lock().map_err(|e| e.to_string())?;
    Ok(LocalApiConfig {
        base_url: lock.base_url.clone(),
        token: Some(lock.token.clone()),
    })
}

#[tauri::command]
fn prepare_for_update(state: State<'_, SharedBackendState>) -> Result<bool, String> {
    println!("[CHECKPOINT Rust] Stopping backend sidecar in preparation for application update...");
    ProcessManager::stop_backend((*state).clone());
    Ok(true)
}

#[tauri::command]
fn get_native_gamepads(state: State<'_, SharedGamepadState>) -> Vec<NativeGamepadSnapshot> {
    if let Ok(lock) = state.snapshots.lock() {
        lock.clone()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn set_native_gamepad_polling(enabled: bool, state: State<'_, SharedGamepadState>) {
    state.polling_enabled.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe_path.to_str().ok_or("Invalid executable path")?;
        if enabled {
            let status = Command::new("reg")
                .args([
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "Checkpoint",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe_str),
                    "/f",
                ])
                .status()
                .map_err(|e| format!("Failed to set autostart: {}", e))?;
            if !status.success() {
                return Err("Failed to register autostart in Windows Registry".to_string());
            }
        } else {
            let _ = Command::new("reg")
                .args([
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "Checkpoint",
                    "/f",
                ])
                .status();
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
fn get_autostart_status() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "Checkpoint",
            ])
            .output();
        if let Ok(out) = output {
            Ok(out.status.success())
        } else {
            Ok(false)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open external URL: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_state: SharedBackendState = Arc::new(Mutex::new(BackendState::new()));
    let gamepad_state: SharedGamepadState = Arc::new(NativeGamepadState::new());
    let state_for_setup = backend_state.clone();
    let state_for_exit = backend_state.clone();
    let gamepad_for_setup = gamepad_state.clone();
    let gamepad_for_exit = gamepad_state.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(backend_state)
        .manage(gamepad_state)
        .invoke_handler(tauri::generate_handler![
            get_local_api_config,
            wait_for_backend_ready,
            get_backend_status,
            restart_backend,
            prepare_for_update,
            get_native_gamepads,
            set_native_gamepad_polling,
            launch_steam_game,
            launch_executable,
            pick_executable_file,
            restore_window,
            open_external_url,
            set_autostart,
            get_autostart_status
        ])
        .setup(move |app| {
            #[cfg(target_os = "windows")]
            {
                // Automatically ensure Windows Startup Apps entry is enabled
                std::thread::spawn(|| {
                    if let Ok(exe_path) = std::env::current_exe() {
                        if let Some(exe_str) = exe_path.to_str() {
                            let _ = std::process::Command::new("reg")
                                .args([
                                    "add",
                                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                                    "/v",
                                    "Checkpoint",
                                    "/t",
                                    "REG_SZ",
                                    "/d",
                                    &format!("\"{}\"", exe_str),
                                    "/f",
                                ])
                                .status();
                        }
                    }
                });
            }

            let state_clone = state_for_setup.clone();
            std::thread::spawn(move || {
                if let Err(e) = ProcessManager::start_backend(state_clone.clone()) {
                    eprintln!("[CHECKPOINT Rust] Failed to start backend: {}", e);
                    if let Ok(mut lock) = state_clone.lock() {
                        lock.status = BackendStatus::Error;
                        lock.error_message = Some(e);
                    }
                }
            });

            spawn_native_gamepad_thread(app.handle().clone(), gamepad_for_setup.clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building CHECKPOINT Gaming Hub");

    app.run(move |_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                println!("[CHECKPOINT Rust] Application exiting; terminating backend...");
                gamepad_for_exit.running.store(false, Ordering::Relaxed);
                ProcessManager::stop_backend(state_for_exit.clone());
            }
            _ => {}
        }
    });
}
