# Changelog

All notable changes to **CHECKPOINT Gaming Hub** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-26

### Added

#### Phase 6: Steam Integration, Automation & Windows Release
* **Steam Account Integration (Phase 6A)**:
  * Connect Steam account via Steam ID64 or vanity community profile URL.
  * Direct connectivity testing and status probe against official Valve Steam Web API.
  * Privacy check warnings for private or friends-only profiles.
  * Windows DPAPI-encrypted credential storage for Steam Web API keys with graceful fallback.
* **Steam Library Synchronization (Phase 6B)**:
  * Fast owned game catalog retrieval via `IPlayerService/GetOwnedGames` and `GetRecentlyPlayedGames`.
  * Multi-tiered alignment with IGDB via external Steam App ID cross-referencing and normalized title matching.
  * Comprehensive import preview modal categorizing titles into *New*, *Existing in Library*, and *Unmatched*.
  * Selective import with full batch progress reporting.
  * Steam Family Sharing support without overriding ownership tags.
  * Strict decoupled preservation of user-entered ratings, personal playtime, and custom notes.
* **Steam Achievement Tracking (Phase 6C)**:
  * Official schema and player unlock status retrieval via `ISteamUserStats/GetSchemaForGame` and `GetPlayerAchievements`.
  * Global unlock percentages via `GetGlobalAchievementPercentagesForApp` to display rarity tags (*Common*, *Rare*, *Ultra Rare*).
  * Dedicated Achievements tab on Game Details view with unlock filter, search, sorting, and spoiler blur/reveal.
  * Automatic 100% completion suggestion upon unlocking all achievements, preserving user choice.
* **Automatic Gameplay Detection (Phase 6D)**:
  * Multi-drive Steam installation scanning via VDF parsing of `libraryfolders.vdf`.
  * Manifest parser for `appmanifest_{appid}.acf` resolving install state, build IDs, and game directories.
  * Native background process polling via `psutil` matching running game executables.
  * Explicit exclusion list filtering out launchers, crash handlers, anti-cheat services, and helper daemons.
  * Automated play session start, heartbeat tracking, and graceful finalization with pause and crash recovery.
* **Game Launcher Engine (Phase 6E)**:
  * Rust Tauri IPC commands for `launch_steam_game` (`steam://rungameid/<id>`) and `launch_executable`.
  * Security path validation enforcing `.exe` extensions and strictly rejecting shell metacharacters (`&`, `|`, `;`, `>`, `<`, `` ` ``, `$`).
  * Direct "Play Game" action on Game Details view with optional auto-minimize and restore on exit.
* **Wishlist Price Tracking (Phase 6F)**:
  * Integrated IsThereAnyDeal (ITAD) API provider for real-time digital store deals and price cuts.
  * Regional currency support prioritizing Indian Rupee (INR) and user-selected localized currencies.
  * Real-time calculation of discount percentages, historical low prices, and target met alerts.
* **Release Packaging & Installer (Phase 6H)**:
  * Tauri 2.0 NSIS Windows installer bundling the compiled Python backend sidecar.
  * SHA-256 integrity verification and automated zero-dependency installation.

#### Phase 5: Gaming Management Features
* **Backlog Prioritizer & Kanban Board (Phase 5A)**:
  * Ranked queue with drag-and-drop and controller-friendly Up/Down reordering.
  * 4-lane Kanban Board (*Planned*, *Now Playing*, *On Hold*, *Completed*).
  * "Set as Next Game" priority shortcut and connected "Up Next" carousel on Overview Dashboard.
* **Gaming Planner & Calendar (Phase 5B)**:
  * Session scheduling with calendar views, repeat rules, and timeline conflict detection.
* **Play Session Tracking & Live HUD (Phase 5C)**:
  * Floating HUD overlay with live timer and Pause/Resume/End controls.
  * Automatic unfinalized session recovery modal on startup after unexpected terminations.
* **Collections & Franchises (Phase 5D)**:
  * Custom playlists with custom artwork and play orders.
  * Franchise grouping with cascade deletion protection.
* **Gaming Journal (Phase 5E)**:
  * Markdown-friendly journal entries with milestone tagging, ratings, and spoiler protection.
* **Honest Statistics Engine (Phase 5F)**:
  * 365-day activity heatmap, monthly trend charts, and non-inflated multi-genre breakdowns.
* **Settings & Storage Diagnostics (Phase 5H)**:
  * Tabbed configuration interface, DPAPI credential manager, and image cache management.
* **Database Backup & Restore (Phase 5I)**:
  * Non-blocking online SQLite WAL backup, safety snapshot restoration, and JSON data exports.

#### Phase 4: Big Picture Mode & Controller Engine
* **10-Foot Console Interface**:
  * Fullscreen Big Picture Mode (`/big-picture`) matching Stitch V2 console designs.
  * Shared `CinematicBackdrop` with smooth 650ms crossfade and accent color synchronization.
* **Spatial Navigation Engine**:
  * 2D geometric raycasting with focus memory, 15% radial deadzone normalization, and Schmitt triggers.
  * Context-aware SVG controller glyphs dynamically switching between Xbox, PlayStation DualSense, and Keyboard prompts.
  * On-Screen Virtual Keyboard (OSK) with controller shortcuts.
  * Native Rust `gilrs` fallback bridge for system gamepad handling.

#### Phase 3: Desktop Shell & Backend Sidecar
* **Self-Contained Python Sidecar**:
  * FastAPI backend compiled into standalone Windows executable with zero runtime Python dependency.
  * Cryptographic ephemeral `X-Checkpoint-Token` handshake and hidden process management.
  * Automatic dynamic loopback port assignment and zero-orphan process termination.

#### Phase 2: Frontend Foundation & Design System
* **CHECKPOINT V2 Visual Experience**:
  * Atmospheric dark surfaces (`#111722` to `#2B384B`), Sora/Inter variable typography, and dynamic accent colors.
  * Multi-view library (Cover Grid, Compact List, Cinematic Library).
  * Game Details view with 6 comprehensive tabs and "Your Journey" timeline.

#### Phase 1: Backend Foundation & External Data Pipeline
* **Local-First Data Pipeline**:
  * Async SQLAlchemy 2.0 with SQLite WAL mode and Alembic migrations.
  * Rate-limited IGDB v4 search client with base-game prioritization.
  * SteamGridDB artwork client with SHA-256 deduplication and local disk caching.

---

[1.0.0]: https://github.com/checkpoint/checkpoint/releases/tag/v1.0.0
