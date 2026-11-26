# CHECKPOINT Gaming Hub — Controller Input & Spatial Navigation Engine

**Document Version:** 1.0.0  
**Status:** Approved Engineering Specification  
**Scope:** Universal Gamepad Handling, Spatial Navigation Engine, 10-Foot Big Picture Mode  

---

## 1. Input Architecture Overview

CHECKPOINT provides a unified, hardware-abstracted input engine capable of switching dynamically between keyboard/mouse and gamepads without lag or UI state loss:

```
+---------------------------------------------------------------------------------------+
|                                  PHYSICAL HARDWARE                                    |
|   Xbox Wireless / Series   |   Sony DualSense (PS5)   |   Nintendo Pro / DirectInput   |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                                HARDWARE ABSTRACTION                                   |
|   Primary: Web Gamepad API (Chromium / Tauri WebView2, 60Hz RequestAnimationFrame)    |
|   Fallback: Tauri Native Rust `gilrs` IPC Bridge (Background / Raw OS Input)          |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                                INPUT NORMALIZATION                                    |
|   - Radial Deadzone Compensation (15% threshold)                                      |
|   - Button Debounce & Initial Repeat Hold (400ms delay, 120ms repeat rate)            |
|   - Controller Profile Detection (Xbox vs. PlayStation button glyph resolution)      |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                             SPATIAL NAVIGATION ENGINE                                 |
|   - 2D Geometric Raycasting (Up, Down, Left, Right vector proximity)                  |
|   - Modal Focus Trapping (Add Game, SteamGridDB Art, Settings, Virtual Keyboard)      |
|   - Focus Restoration Memory (Remembers last active card across tab transitions)      |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                                PRESENTATION LAYER                                     |
|   Desktop Mode (Subtle Ring)   <=================>   Big Picture Mode (High Contrast) |
|   Contextual Controller Glyphs [ A ] [ B ] [ X ] [ Y ] [ LB ] [ RB ]                  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Hardware Detection & Normalization

### 2.1 Standard Gamepad API Mapping
Controllers are matched against standard W3C Gamepad mapping indices:

| Gamepad Button Index | Standard Name | Xbox Glyph | PlayStation Glyph | CHECKPOINT Default Action |
| :---: | :---: | :---: | :---: | :--- |
| `0` | Bottom Face | **A** (Green) | **Cross** (Blue) | Confirm / Select / Open Game |
| `1` | Right Face | **B** (Red) | **Circle** (Red) | Cancel / Back / Dismiss Modal |
| `2` | Left Face | **X** (Blue) | **Square** (Pink) | Quick Action / Update Progress |
| `3` | Top Face | **Y** (Yellow) | **Triangle** (Green) | Global Search / Focus Search Bar |
| `4` | Left Bumper | **LB** | **L1** | Cycle Tab / View Mode Left |
| `5` | Right Bumper | **RB** | **R1** | Cycle Tab / View Mode Right |
| `6` | Left Trigger | **LT** (Analog) | **L2** (Analog) | Fast Scroll Up / Page Up |
| `7` | Right Trigger | **RT** (Analog) | **R2** (Analog) | Fast Scroll Down / Page Down |
| `8` | Back / Select | **View** / **Back** | **Share** / **Create** | Toggle Big Picture Mode |
| `9` | Start / Options | **Menu** / **Start** | **Options** | Context Action Menu |
| `10` | Left Stick Click | **LS** | **L3** | Reset Filters / Sort Mode |
| `11` | Right Stick Click | **RS** | **R3** | Cycle Card Size Scale |
| `12` | D-Pad Up | **D-Up** | **D-Up** | Spatial Navigate Up |
| `13` | D-Pad Down | **D-Down** | **D-Down** | Spatial Navigate Down |
| `14` | D-Pad Left | **D-Left** | **D-Left** | Spatial Navigate Left |
| `15` | D-Pad Right | **D-Right** | **D-Right** | Spatial Navigate Right |
| `16` | Home / Guide | **Xbox Guide** | **PS Button** | Home Dashboard / Quick Launch |

### 2.2 Analog Stick Deadzone & Radial Normalization
To prevent stick drift on worn analog hardware, the input loop applies a radial deadzone formula:

$$\text{magnitude} = \sqrt{x^2 + y^2}$$

$$\text{If } \text{magnitude} < 0.15 \implies x = 0, y = 0$$

$$\text{Normalized Output} = \frac{\text{vector}}{\text{magnitude}} \times \left(\frac{\text{magnitude} - 0.15}{1.0 - 0.15}\right)$$

### 2.3 Debounce & Repeat Timing
* **Initial Input Delay**: `400ms` before triggering continuous directional movement.
* **Repeat Rate**: `120ms` between repeat pulses.
* **Single Tap Window**: Prevents double-skipping grid items when pressing D-pad buttons.

---

## 3. Spatial Navigation Engine Specification

Unlike web tab order (linear 1D indexing), CHECKPOINT implements a **2D geometric spatial raycaster**:

### 3.1 Proximity Calculation Algorithm
When directional input $(\Delta x, \Delta y)$ is triggered:
1. Identify the bounding rectangle $R_{\text{current}}$ of the active focused DOM node.
2. Filter all candidate focusable elements matching `[data-nav-item="true"]` within the active container.
3. Eliminate candidates not lying in the intended half-plane (e.g., if moving `Right`, $x_{\text{candidate}} > x_{\text{current}}$).
4. Compute weighted directional distance metric:
   $$D = \Delta_{\text{primary\_axis}} \times 1.0 + \Delta_{\text{cross\_axis}} \times 2.0 + \text{edge\_overlap\_penalty}$$
5. Focus the candidate minimizing $D$ and trigger standard DOM focus events.

### 3.2 Modal Focus Trapping
* When a modal dialog opens (`AddGameModal`, `SteamGridDB Artwork Modal`, or `Virtual Keyboard`), spatial navigation locks all candidates outside the modal container (`aria-modal="true"`).
* Pressing `B` / `Circle` dismisses the modal and restores focus to the trigger button that launched it.

### 3.3 Focus Restoration Memory
* When navigating away from a game shelf or sub-tab, the engine caches the last focused element ID.
* Upon returning, focus snaps directly back to the previously active element instead of resetting to the top-left item.

---

## 4. Context-Aware Dynamic Controller Glyphs

The UI detects the connected hardware profile via `gamepad.id` vendor matching:

```typescript
export function resolveControllerProfile(id: string): 'xbox' | 'playstation' | 'nintendo' | 'generic' {
  const s = id.toLowerCase();
  if (s.includes('054c') || s.includes('dualsense') || s.includes('dualshock')) return 'playstation';
  if (s.includes('045e') || s.includes('xbox') || s.includes('x-box')) return 'xbox';
  if (s.includes('057e') || s.includes('nintendo') || s.includes('switch')) return 'nintendo';
  return 'xbox'; // Default to Xbox glyphs for PC gaming standard
}
```

* **PlayStation DualSense**: Renders Cross, Circle, Square, Triangle SVG vector glyphs.
* **Xbox**: Renders A, B, X, Y SVG vector glyphs.
* Footer legends automatically adjust button labels based on the active screen context.

---

## 5. On-Screen Virtual Keyboard (OSK) for Big Picture Mode

For a couch 10-foot experience, searching the catalog or editing game notes cannot require reaching for a physical keyboard:

* **Grid Layout**: 4-row QWERTY keyboard with numbers, symbols, space, backspace, and submit.
* **Shortcuts**:
  * `A` / `Cross`: Type focused character
  * `X` / `Square`: Backspace
  * `Y` / `Triangle`: Spacebar
  * `Start` / `Options`: Submit / Execute search
  * `B` / `Circle`: Close keyboard / Dismiss
* **Auto-Activation**: Opens automatically whenever a text input field receives controller focus in Big Picture Mode.

---

## 6. Native Rust Gilrs Fallback Architecture

If the Windows WebView2 process loses window focus or direct Gamepad API polling stalls:
1. Tauri's native Rust thread runs `gilrs` continuously on a dedicated OS thread.
2. Gamepad button presses are captured directly at the Windows XInput/DirectInput driver level.
3. Events are emitted into the frontend via Tauri event channels: `window.emit('checkpoint://gamepad-event', payload)`.
4. The frontend's `useGamepad` hook automatically bridges native events if web polling is inactive.
