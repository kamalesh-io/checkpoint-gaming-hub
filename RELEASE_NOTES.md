# CHECKPOINT Gaming Hub v1.1.0 — Cinematic UI V3 & Sound Experience

**Release Date:** November 28, 2026  
**Platform:** Windows 10 / 11 (64-bit)  
**Distribution:** GitHub Official Signed Release & Automated Updates  
**Build Target:** Desktop Application (`x86_64-pc-windows-msvc`)  

---

## 🌟 Executive Summary

**CHECKPOINT Gaming Hub v1.1.0** represents the largest evolution of CHECKPOINT to date. This milestone release replaces the previous administrative dashboard with **Cinematic UI V3**—a premium living-room console interface inspired by PlayStation 5 and Steam Big Picture—paired with an original, zero-latency **Procedural Web Audio Sound System** and a tamper-proof, cryptographically signed **Tauri 2.0 Automatic Update System**.

---

## 🚀 Key Feature Highlights

### 1. 🎬 Cinematic UI V3 Design System
* **Atmospheric Living-Room Aesthetics**: Fully eliminated legacy sidebar panels and flat SaaS layouts in favor of an immersive, edge-to-edge console experience.
* **Charcoal Surface Architecture**: Neutral, elegant base tones (`#0C0F12` background, `#14181D` surfaces, `#1E2329` elevated cards) that dynamically highlight game artwork.
* **Fluid Floating Capsule Dock (`FloatingDock.tsx`)**: Translucent floating bottom navigation capsule featuring glassmorphism backdrop blur, animated active tab indicator, live Wishlist deal counter badge, and full gamepad spatial navigation.
* **Cinematic Hero Showcase (`OverviewPage.tsx`)**: Full-bleed hero banner showcasing edge-to-edge artwork, official game logos, "CURRENTLY PLAYING" status, progress/playtime telemetry strip, and PlayStation-inspired "Play Game" action pill.
* **Continue Playing Carousel**: Horizontal 16:9 game cards with active gold glowing borders, embedded logo artwork, and instant-launch shortcuts.
* **Plus Jakarta Sans & DM Sans Typography**: Modern, rounded display typography bundled locally for pristine rendering at high-DPI and 4K resolutions.

### 2. 🎵 Procedural Web Audio Sound System
* **Original PlayStation-Inspired Acoustic Cues**: Synthesized entirely via the browser Web Audio API at runtime—**zero external audio asset files, zero network calls, zero latency**.
* **Synthesized Audio Presets**:
  * Navigation Move Tick (soft 45ms sine blip).
  * Selection & Confirm Chime (resonant dual-tone chime).
  * Back & Dismiss (warm descending acoustic drop).
  * Tab Switch (airy resonant filter pop).
  * Modal Transitions (gentle ascending/descending acoustic envelopes).
  * Game Launch Sub-Bass (cinematic low-frequency rise).
  * Achievement Fanfare (triumphant harmonic triad).
* **Optional Ambient Menu Synthesizer**: Subtle LFO-modulated synthesizer pad loop for an atmospheric menu lounge experience (disabled by default, toggleable in Settings).
* **Customizable Audio Preferences**: Full audio controls in **Settings $\rightarrow$ Sound & Audio** with volume sliders, individual category switches, and instant test triggers.

### 3. 🔄 Tauri 2.0 Automatic Updates & Cryptographic Signing
* **Official Tauri 2.0 Updater Plugin**: Seamless background update checks with zero external paid servers or third-party cloud infrastructure.
* **Minisign Ed25519 Cryptographic Verification**: All update bundles and manifests are digitally signed using Minisign asymmetric public-key cryptography. Unauthorized modifications or downgraded packages are rejected by default.
* **Cinematic Update Dialog (`UpdateDialog.tsx`)**:
  * Non-intrusive notification indicator in top navigation bar (`ArrowUpCircle` pulsing pill).
  * Markdown release notes viewer with styled bullet points and version comparison.
  * Real-time download progress bar showing transferred MB, total size, percentage, and instantaneous transfer rate (MB/s).
* **Safe Migration & Process Lifecycle Manager**:
  * Verifies no active game sessions are currently running before starting an update.
  * Triggers an automatic SQLite WAL online point-in-time backup snapshot before file replacement.
  * Invokes native `prepare_for_update` IPC to terminate the Python sidecar process, completely avoiding Windows file-locking conflicts (`EBUSY` / Error 32).
* **Configurable Update Preferences**: Frequency intervals (startup, 6h, 12h, 24h, 48h), automatic background downloading, notification toggles, and "Defer while gaming" guard.

### 4. 🛠️ All V1.0.1 Bug Fix Batches Preserved
* Preserves 100% of all fixes from Bug Fix Batches 01–04 (BUG-001 through BUG-020):
  * Multi-resolution Windows ICO and dark NSIS wizard banners.
  * SQLite WAL safety and sidecar IPC handshake authentication.
  * Steam playtime and Checkpoint local session tracking separation.
  * Real-time IsThereAnyDeal price and regional currency support.
  * 10-foot controller navigation with stick deadzone clamping and PlayStation glyph detection.

---

## 🔒 Security & Privacy Architecture

* **100% Local-First**: SQLite database (`%APPDATA%/Checkpoint/checkpoint.db`) remains completely local on your machine.
* **Encrypted Secrets**: DPAPI / Windows Credential Manager secures all API tokens and Steam credentials.
* **Tamper-Proof Updates**: Update manifests and binary packages are verified against the embedded Minisign Ed25519 public key.
* **Zero Telemetry**: No tracking, analytics, or external phone-home requests.

---

## 📦 Release Artifacts & Verification

| File Name | Description | Architecture |
|---|---|---|
| `CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe` | Standard Windows NSIS Setup Installer | x86_64 Windows 10/11 |
| `CHECKPOINT Gaming Hub_1.1.0_x64_en-US.msi` | Windows MSI Enterprise Installer | x86_64 Windows 10/11 |
| `CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe.sig` | Minisign Ed25519 Cryptographic Signature | Ed25519 Detached Signature |
| `latest.json` | Tauri 2.0 Update Distribution Manifest | JSON Metadata |
| `SHA256SUMS.txt` | Cryptographic SHA-256 Package Hashes | SHA-256 Hashes |

### Verification Test Suite Baseline:
* **Backend Suite:** `39/39` tests passed (`pytest`).
* **Frontend Suite:** `39/39` tests passed (`node:test`).
* **Rust Shell Suite:** `4/4` tests passed (`cargo test`).
* **TypeScript Compiler:** `0` errors (`tsc -b`).

---

## 📥 Installation & Upgrade Instructions

### For New Users:
1. Download `CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe` from GitHub Releases.
2. Launch the installer. Choose either **All Users** (`C:\Program Files\CHECKPOINT Gaming Hub`) or **Current User** (`%LOCALAPPDATA%\Programs\CHECKPOINT Gaming Hub`).
3. Follow the wizard to complete installation. CHECKPOINT will launch automatically.

### For Existing Users:
* Existing users on v1.0.0 or v1.0.1 can run the v1.1.0 installer directly over their existing installation.
* All existing libraries, playtime records, journal entries, and API credentials in `%APPDATA%/Checkpoint/` will remain intact.
* Starting with v1.1.0, future updates will download and install automatically via the integrated Update Manager.
