use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use gilrs::{Axis, Button, Event, EventType, Gilrs};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGamepadSnapshot {
    pub index: usize,
    pub id: String,
    pub name: String,
    pub connected: bool,
    pub mapping: String,
    pub buttons: [f32; 17],
    pub axes: [f32; 4],
}

pub struct NativeGamepadState {
    pub polling_enabled: AtomicBool,
    pub running: AtomicBool,
    pub snapshots: Mutex<Vec<NativeGamepadSnapshot>>,
}

impl NativeGamepadState {
    pub fn new() -> Self {
        Self {
            polling_enabled: AtomicBool::new(false),
            running: AtomicBool::new(true),
            snapshots: Mutex::new(Vec::new()),
        }
    }
}

pub type SharedGamepadState = Arc<NativeGamepadState>;

fn format_controller_id(gamepad: &gilrs::Gamepad) -> String {
    let vid = gamepad
        .vendor_id()
        .map(|v| format!("{:04x}", v))
        .unwrap_or_else(|| "0000".to_string());
    let pid = gamepad
        .product_id()
        .map(|p| format!("{:04x}", p))
        .unwrap_or_else(|| "0000".to_string());
    format!("{} (Vendor: {} Product: {})", gamepad.name(), vid, pid)
}

fn capture_gamepad_snapshot(index: usize, gamepad: &gilrs::Gamepad) -> NativeGamepadSnapshot {
    let mut buttons = [0.0f32; 17];
    let btn_map: [(usize, Button); 17] = [
        (0, Button::South),
        (1, Button::East),
        (2, Button::West),
        (3, Button::North),
        (4, Button::LeftTrigger),
        (5, Button::RightTrigger),
        (6, Button::LeftTrigger2),
        (7, Button::RightTrigger2),
        (8, Button::Select),
        (9, Button::Start),
        (10, Button::LeftThumb),
        (11, Button::RightThumb),
        (12, Button::DPadUp),
        (13, Button::DPadDown),
        (14, Button::DPadLeft),
        (15, Button::DPadRight),
        (16, Button::Mode),
    ];

    for (idx, btn) in btn_map {
        if let Some(data) = gamepad.button_data(btn) {
            buttons[idx] = if data.is_pressed() {
                data.value().max(1.0)
            } else {
                data.value()
            };
        } else if gamepad.is_pressed(btn) {
            buttons[idx] = 1.0;
        }
    }

    // W3C Gamepad API uses negative-Y = up, positive-Y = down; gilrs uses positive-Y = up.
    let lx = gamepad.value(Axis::LeftStickX);
    let ly = -gamepad.value(Axis::LeftStickY);
    let rx = gamepad.value(Axis::RightStickX);
    let ry = -gamepad.value(Axis::RightStickY);

    NativeGamepadSnapshot {
        index,
        id: format_controller_id(gamepad),
        name: gamepad.name().to_string(),
        connected: gamepad.is_connected(),
        mapping: "standard".to_string(),
        buttons,
        axes: [lx, ly, rx, ry],
    }
}

pub fn spawn_native_gamepad_thread(app_handle: AppHandle, state: SharedGamepadState) {
    thread::spawn(move || {
        let mut gilrs = match Gilrs::new() {
            Ok(g) => g,
            Err(err) => {
                eprintln!("[CHECKPOINT gilrs] Native gamepad subsystem unavailable: {}", err);
                return;
            }
        };

        let mut id_to_slot: HashMap<gilrs::GamepadId, usize> = HashMap::new();
        let mut next_slot = 0usize;

        while state.running.load(Ordering::Relaxed) {
            let polling = state.polling_enabled.load(Ordering::Relaxed);
            let window_focused = app_handle
                .get_webview_window("main")
                .and_then(|w| w.is_focused().ok())
                .unwrap_or(false);

            // Drain pending OS events cleanly even while suppressed so event queue doesn't grow stale
            let mut saw_event = false;
            while let Some(Event { id, event, .. }) = gilrs.next_event() {
                saw_event = true;
                id_to_slot.entry(id).or_insert_with(|| {
                    let s = next_slot;
                    next_slot += 1;
                    s
                });
                match event {
                    EventType::Connected | EventType::Disconnected => {
                        if let Ok(mut lock) = state.snapshots.lock() {
                            *lock = gilrs
                                .gamepads()
                                .filter(|(_, gp)| gp.is_connected())
                                .map(|(gid, gp)| {
                                    let slot = *id_to_slot.entry(gid).or_insert_with(|| {
                                        let s = next_slot;
                                        next_slot += 1;
                                        s
                                    });
                                    capture_gamepad_snapshot(slot, &gp)
                                })
                                .collect();
                        }
                    }
                    _ => {}
                }
            }

            // Never intercept controller input when another game/app is focused or native fallback is disabled
            if !polling || !window_focused {
                thread::sleep(Duration::from_millis(200));
                continue;
            }

            let snapshots: Vec<NativeGamepadSnapshot> = gilrs
                .gamepads()
                .filter(|(_, gp)| gp.is_connected())
                .map(|(gid, gp)| {
                    let slot = *id_to_slot.entry(gid).or_insert_with(|| {
                        let s = next_slot;
                        next_slot += 1;
                        s
                    });
                    capture_gamepad_snapshot(slot, &gp)
                })
                .collect();

            if let Ok(mut lock) = state.snapshots.lock() {
                *lock = snapshots.clone();
            }

            if !snapshots.is_empty() || saw_event {
                let _ = app_handle.emit("checkpoint://gamepad-state", &snapshots);
            }

            thread::sleep(Duration::from_millis(16));
        }
    });
}
