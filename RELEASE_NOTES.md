# CHECKPOINT Gaming Hub — Release Notes V1.0.0 ("First Light")

**Release Version:** 1.0.0  
**Release Date:** 2026-11-26  
**Target Platform:** Windows 10 / 11 (64-bit)  
**Distribution:** Standalone NSIS Windows Installer (`CHECKPOINT_1.0.0_x64-setup.exe`)  

---

## Welcome to CHECKPOINT V1.0.0

CHECKPOINT Gaming Hub is a cinematic, local-first personal gaming management hub and 10-foot launcher for Windows. Designed from the ground up for enthusiasts who want total ownership over their gaming data, CHECKPOINT unifies games across Steam, GOG, Epic Games Store, Ubisoft Connect, EA App, PlayStation, and Xbox into an atmospheric, controller-navigable interface.

---

## Key Highlights

### 1. Zero Cloud Lock-In & Local-First Architecture
* Everything runs 100% locally on your PC via an embedded SQLite database with Write-Ahead Logging (WAL).
* Zero telemetry, zero cloud user accounts, and zero mandatory online check-ins.
* API credentials (IGDB, SteamGridDB, Steam Web API, IsThereAnyDeal) are encrypted securely using Windows DPAPI.

### 2. Full Steam Integration & Automated Gameplay Tracking
* **One-Click Library Sync**: Connect your Steam account via Steam ID64 or profile URL to import your catalog.
* **Live Achievement Sync**: Track your unlocked achievements, global rarity percentages, and spoiler-protected descriptions.
* **Automatic Process Detection**: Scans multi-drive Steam installations and monitors running game processes in the background to automatically log play sessions and track playtime without manual timers.
* **Native Game Launcher**: Launch games directly via Steam URIs or custom executable paths with automatic window management.

### 3. Big Picture Mode & Universal Controller Support
* Seamlessly toggle between Desktop Mode and a 10-foot borderless fullscreen console interface.
* 2D geometric spatial raycasting engine with 15% radial deadzone normalization and stick drift resistance.
* Context-aware controller glyphs automatically detecting Xbox and PlayStation DualSense controllers.
* Integrated On-Screen Virtual Keyboard (OSK) with controller shortcuts.

### 4. Rich Gaming Management Suite
* **Ranked Backlog & Kanban**: Organize your queue and Kanban lanes with drag-and-drop or controller reordering.
* **Gaming Journal & Notes**: Record playthrough milestones, respec notes, and personal impressions with spoiler blur.
* **365-Day Activity Heatmap**: View your gaming habits through honest, uninflated statistics.
* **Wishlist Price Tracking**: Monitor discounts and historical lows in real-time powered by IsThereAnyDeal.

---

## Verification & Quality Baseline

| Verification Category | Status | Metrics / Details |
| :--- | :--- | :--- |
| **Backend Unit & Integration Tests** | Passed | 29/29 tests green (`pytest`) |
| **Frontend Unit Tests** | Passed | 9/9 tests green (`node --test`) |
| **Rust Shell & Security Tests** | Passed | 4/4 tests green (`cargo test`) |
| **TypeScript Strict Checking** | Passed | 0 errors (`tsc -b --noEmit`) |
| **ESLint Quality Analysis** | Passed | 0 errors, 0 warnings |
| **Vite Production Bundler** | Passed | Clean build in 8.41s |
| **Database Migrations** | Passed | Alembic head `b2c3d4e5f6g7` applied |

---

## Important Disclosures & Notes

1. **Self-Signed Windows SmartScreen Notice**:
   * As an open-source local-first release, the Windows installer is not signed with an expensive commercial Extended Validation (EV) certificate.
   * When launching the installer, Windows SmartScreen may display an alert. Click *"More info"* $\rightarrow$ *"Run anyway"* to proceed.
2. **Controller Testing Hardware Disclosure**:
   * All spatial raycasting, deadzone clamping, OSK navigation, and glyph mapping have been verified using synthetic W3C Gamepad API test suites and Rust `gilrs` input compilation. Physical USB/Bluetooth controller verification remains subject to individual hardware device profiles.
3. **Steam Profile Privacy**:
   * Unlocking achievements and fetching game catalogs requires your Steam Community profile and game details privacy settings to be set to *Public*.

---

## Package Integrity

* **Installer Filename:** `CHECKPOINT_1.0.0_x64-setup.exe`
* **Target OS:** Windows 10 (Build 19041+) / Windows 11 (64-bit)
* **Architecture:** x86_64
