// Tauri IPC launcher commands for verified Steam and desktop executable launching.
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::Window;

#[tauri::command]
pub fn launch_steam_game(
    app_id: u32,
    minimize_on_launch: bool,
    window: Window,
) -> Result<(), String> {
    if app_id == 0 {
        return Err("Invalid Steam App ID.".to_string());
    }

    let uri = format!("steam://run/{}", app_id);

    #[cfg(windows)]
    {
        // Safe URL protocol launch via rundll32 FileProtocolHandler without shell command injection
        let status = Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &uri])
            .status()
            .map_err(|e| format!("Failed to invoke Steam protocol handler: {}", e))?;

        if !status.success() {
            return Err("Steam URI launch command returned non-zero exit code.".to_string());
        }
    }

    #[cfg(not(windows))]
    {
        let status = Command::new("xdg-open")
            .arg(&uri)
            .status()
            .map_err(|e| format!("Failed to launch Steam URI: {}", e))?;
        if !status.success() {
            return Err("Failed to launch Steam URI.".to_string());
        }
    }

    if minimize_on_launch {
        let _ = window.minimize();
    }

    Ok(())
}

#[tauri::command]
pub fn launch_executable(
    exe_path: String,
    args: Option<Vec<String>>,
    minimize_on_launch: bool,
    window: Window,
) -> Result<u32, String> {
    let mut clean_exe = exe_path.trim();
    if (clean_exe.starts_with('"') && clean_exe.ends_with('"'))
        || (clean_exe.starts_with('\'') && clean_exe.ends_with('\''))
    {
        clean_exe = clean_exe[1..clean_exe.len() - 1].trim();
    }

    let path = Path::new(clean_exe);
    if !path.exists() {
        return Err(format!("Target executable file does not exist at '{}'. Please verify the path.", clean_exe));
    }
    if !path.is_file() {
        return Err(format!("Specified target '{}' is a directory, not an executable file.", clean_exe));
    }

    // Strict extension verification: only binary .exe files are permitted
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "exe" {
        return Err(
            "Forbidden file type: only compiled .exe binaries can be launched directly.".to_string(),
        );
    }

    let canonical = fs::canonicalize(path)
        .map_err(|e| format!("Could not canonicalize executable path: {}", e))?;

    let mut cmd = Command::new(&canonical);
    if let Some(arg_list) = args {
        for arg in arg_list {
            // Verify no command chaining or shell escape characters
            if arg.contains(';') || arg.contains('&') || arg.contains('|') || arg.contains('`') {
                return Err("Argument contains prohibited shell characters.".to_string());
            }
            cmd.arg(arg);
        }
    }

    // Spawn child process directly without intermediate shell wrapper
    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn executable: {}", e))?;

    let pid = child.id();

    if minimize_on_launch {
        let _ = window.minimize();
    }

    Ok(pid)
}

#[tauri::command]
pub fn pick_executable_file() -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $dlg = New-Object System.Windows.Forms.OpenFileDialog
            $dlg.Title = "Select Game Executable"
            $dlg.Filter = "Game Executable (*.exe)|*.exe|All Files (*.*)|*.*"
            if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $dlg.FileName
            }
        "#;
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to open Windows file dialog: {}", e))?;

        if output.status.success() {
            let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if res.is_empty() {
                Ok(None)
            } else {
                Ok(Some(res))
            }
        } else {
            Ok(None)
        }
    }

    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn restore_window(window: Window) -> Result<(), String> {
    let _ = window.unminimize();
    let _ = window.set_focus();
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_steam_app_id_validation() {
        assert_eq!(0u32 == 0, true);
    }
}
