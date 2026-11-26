# CHECKPOINT Gaming Hub — Phased Implementation Roadmap

**Document Version:** 1.0.0  
**Status:** Approved Roadmap Baseline  
**Target Platform:** Windows 10/11 Desktop Application  

---

## 1. Roadmap Overview & Timeline Strategy

The CHECKPOINT implementation follows an incremental, evidence-verified phased execution model. Every phase has clear deliverables, automated testing gates, and strict acceptance criteria:

```
[ Phase 0: Architecture & Specs ] (CURRENT)
              |
              v
[ Phase 1: Backend & Data Pipeline ]
  - FastAPI Core + SQLite WAL + Alembic Migrations
  - IGDB & SteamGridDB Clients + Image Caching
  - Security Handshake & Pytest Suite
              |
              v
[ Phase 2: Frontend & Design Tokens ]
  - React + Vite + TypeScript Setup
  - Tailwind Config + Sora / Inter Typography
  - Stitch V2 Component Sticker Sheets (Button, Card, Badge, Modal, Tabs)
              |
              v
[ Phase 3: Desktop Shell & Core Screens ]
  - Tauri 2.0 Shell + Python Sidecar Lifecycle Manager
  - Overview Dashboard (Screen 1)
  - My Library (Screen 2: Grid, List, Cinema)
  - Discover & Search (Screen 3)
  - Add Game Modal (Screen 4)
  - Game Details (Screen 5)
              |
              v
[ Phase 4: Big Picture Mode & Controller Engine ]
  - Fullscreen 10-Foot Big Picture View (Screen 6)
  - Gamepad API Hook + 2D Spatial Raycaster Navigation
  - Context-Aware Glyphs (Xbox vs. PlayStation)
  - On-Screen Virtual Keyboard (OSK) + Gilrs Rust Fallback
              |
              v
[ Phase 5: Secondary Views & Production Packaging ]
  - Backlog Prioritizer, Gaming Planner, Wishlist, Collections
  - Full Gaming Journal + Stats Engine + Backup/Restore
  - Tauri NSIS Windows Installer (.msi / .exe)
              |
              v
[ Phase 6: Post-MVP Enhancements ]
  - Steam Library Sync, Process Playtime Tracker, Executable Launcher
```

---

## 2. Phase-by-Phase Execution Details

---

### Phase 0: Project Documentation & Architecture (Current Phase)
* **Status**: Complete & Verified.
* **Deliverables**:
  * Comprehensive development specifications (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `DATABASE.md`, `API.md`, `CONTROLLER.md`, `SECURITY.md`, `TESTING.md`, `ROADMAP.md`).
  * `.gitignore` configured to protect `.env`, databases, caches, and build artifacts.
  * `AGENTS.md` persistent instructions and `README.md`.
* **Acceptance Criteria**:
  * [x] Zero secrets printed, exposed, or committed.
  * [x] Monorepo architecture documented with clear boundary definitions.
  * [x] Stitch V2 designs codified as the visual source of truth.

---

### Phase 1: Backend Foundation & External Data Pipeline
* **Status**: Complete & Verified (`pytest` 19/19 passing).
* **Goal**: Establish the local data persistence tier, external API integrations, and local API security.
* **Key Tasks**:
  1. Initialize Python virtual environment with Poetry or standard `pip` (`pyproject.toml`).
  2. Implement async SQLAlchemy 2.0 database engine with SQLite WAL PRAGMAs.
  3. Author initial Alembic migration for all tables (`games`, `library_entries`, `game_artworks`, `play_sessions`, `journal_entries`, etc.).
  4. Build async HTTPX clients for IGDB v4 (with Twitch OAuth token cache and 4 req/sec rate limiting) and SteamGridDB.
  5. Implement the local artwork cache service with SHA-256 deduplication and image magic byte verification.
  6. Implement the `X-Checkpoint-Token` handshake middleware and loopback interface binding.
  7. Implement FastAPI routers: `/system`, `/search`, `/games`, `/library`, `/artwork`.
  8. Build comprehensive Pytest suite with mock HTTPX transports.
* **Acceptance Criteria**:
  * [x] `pytest tests/` passes with 100% green status across all models, schemas, and endpoints.
  * [x] IGDB search returns formatted candidate titles with base-game prioritization.
  * [x] High-res 2:3 covers and 16:9 heroes download and cache safely in `%APPDATA%/Checkpoint/artwork_cache/`.
  * [x] Requests without valid `X-Checkpoint-Token` return HTTP 401.

---

### Phase 2 (2A–2F): Frontend Foundation, Design System & Core Desktop Screens
* **Status**: Complete & Verified (Phases 2A–2F).
* **Goal**: Scaffold the React + Tauri desktop client, implement CHECKPOINT V2 design tokens, UI primitives, API layer, and the 5 core desktop views.
* **Key Tasks**:
  1. Scaffold `frontend/` using Vite with React + TypeScript + Tauri 2.0 shell (`src-tauri/`).
  2. Configure `tailwind.config.ts` with CHECKPOINT V2 tokens (surfaces, CSS-variable dynamic accents, Sora/Inter typography, motion curves).
  3. Bundle local variable fonts for `Sora` and `Inter`.
  4. Implement atomic UI components based on Stitch sticker sheets (`Button`, `IconButton`, `Input`, `SearchInput`, `Select`, `Checkbox`, `Badge`, `StatusBadge`, `ProgressBar`, `Tabs`, `Modal` with focus trap, `DropdownMenu`, `ContextMenu`, `Skeleton`, `EmptyState`, `ErrorState`, `ControllerButtonHint`, `ToastViewport`, `GameArtwork`, `GameLogo`, `GameCoverCard`, `LandscapeGameCard`, `CinematicHero`, `GameShelf`).
  5. Configure Zustand client stores (`appStore`, `themeStore`, `libraryStore`, `toastStore`).
  6. Implement TanStack Query hooks (`useSystemQueries`, `useLibraryQueries`, `useSearchQueries`, `useArtworkQueries`), authenticated Blob artwork cache, and `BackendGate`.
  7. Implement **Overview Dashboard**, **My Library** (Grid/List/Cinematic, filters, sort, zoom, franchise grouping), **Discover & Search**, **Add Game Modal**, **Wishlist**, **Game Details** (6 tabs + `Your Journey`), **Update Progress Modal**, **SteamGridDB Artwork Selector**, custom frameless Tauri window controls, and **Settings** diagnostics.
* **Acceptance Criteria**:
  * [x] `tsc`, `eslint`, Vite build, Node frontend unit tests (`npm run test`), `cargo check`, and `pytest` pass cleanly.
  * [x] Theme accent switcher dynamically tints primary buttons, badges, and progress bars via CSS custom properties (`--accent-active`).
  * [x] All interactive elements display `[data-nav-item="true"]` and visible keyboard focus outlines.
  * [x] Full-stack E2E browser verification completed across Overview, My Library, Discover, Wishlist, Add Game Modal, Game Details, Update Progress, SteamGridDB Artwork Selector, and persistence across backend restart.

---

### Phase 3: Sidecar Lifecycle Manager & Desktop Lifecycle
* **Status**: Complete & Verified (Phase 3).
* **Goal**: Package the FastAPI backend into a standalone executable via PyInstaller and implement automated Rust-managed sidecar startup, health verification, credential management, and teardown.
* **Key Tasks**:
  1. Package FastAPI + Uvicorn + SQLAlchemy + Alembic + Pillow + HTTPX into `src-tauri/binaries/checkpoint-backend-x86_64-pc-windows-msvc.exe` via `backend/checkpoint-backend.spec` and `backend/build_sidecar.py` (excluding `.env`, DBs, caches, and tests).
  2. Implement `src-tauri/src/process_manager.rs` for cryptographic ephemeral `X-Checkpoint-Token` generation, `%APPDATA%/Checkpoint/` storage setup, hidden process spawn (`CREATE_NO_WINDOW`), race-free dynamic loopback port handshake (`CHECKPOINT_READY=<port>`), authenticated HTTP health probe, IPC commands (`get_local_api_config`, `get_backend_status`, `restart_backend`), and zero-orphan teardown (`POST /api/v1/system/shutdown` + stdin pipe drop + kill fallback).
  3. Implement multi-stage initialization UI (`StartupScreen.tsx`), retry/restart recovery (`BackendGate.tsx`), emblem logo update (`Checkpoint Gaming Emblem.png`), and `%APPDATA%/Checkpoint/credentials.json` configuration (`SettingsPage.tsx` + `POST /api/v1/system/credentials`).
* **Acceptance Criteria**:
  * [x] User can search IGDB, select a game, add it via modal, and view it in My Library with locally cached artwork.
  * [x] Clicking different hero carousel games transitions backdrops and dynamic accent colors cleanly.
  * [x] Standalone sidecar binary launches cleanly without Python interpreter, dynamically falls back when port 8765 is occupied, isolates user data/credentials in `%APPDATA%/Checkpoint/`, and exits with zero orphaned processes.
  * [x] Rust sidecar process manager (`cargo build` / `cargo check`), Pytest (21/21), ESLint, TypeScript, and Vite production build pass cleanly.

---

### Phase 4: Big Picture Mode, Controller Engine & Spatial Navigation
* **Status**: Complete & Verified (Phase 4).
* **Goal**: Implement the 10-foot television experience and universal controller engine.
* **Key Tasks**:
  1. Implement **Screen 6: Big Picture Mode**:
     * Borderless fullscreen console interface (`/big-picture`) matching Stitch `node_11731173976490379291` with top horizontal navigation, Big Picture Home spotlight + 4-card 16:9 carousel, Console Library, Discover + OSK, Wishlist, Settings, and Game Details.
     * Shared `CinematicBackdrop` preloaded 650ms crossfade + theme accent sync across Desktop & Big Picture modes, preserving active selection when switching modes.
     * Permanent contextual controller button glyph bar (`ControllerGlyphLegend`).
  2. Build universal controller engine (`GamepadInputEngine`, `controllerManager`, `controllerStore`) with 15% configurable radial deadzone, edge debouncing, Schmitt trigger stick hysteresis, held repeat delay/rate, and multi-controller priority switching.
  3. Implement 2D geometric spatial raycaster engine (`spatialEngine.ts`, `useSpatialNavigation.ts`) with modal/listbox focus trapping, route focus restoration memory, custom controller-safe `<Select>` picker, right-stick smooth scroll, and distinct controller focus scale/outline visuals.
  4. Implement context-aware SVG controller glyphs (`ControllerGlyph.tsx` for Xbox, PlayStation DualSense, and Keyboard) and Controller Settings + Input Tester (`ControllerSettingsPanel.tsx`).
  5. Build On-Screen Virtual Keyboard (`VirtualKeyboardModal.tsx`) with QWERTY/Shift/Symbol layers and controller shortcuts.
  6. Implement native Rust `gilrs` fallback bridge (`src-tauri/src/gamepad.rs`) strictly gated on window focus and deduplicated against Web Gamepad API.
* **Acceptance Criteria**:
  * [x] Spatial navigation and modals (`AddGameModal`, `UpdateProgressModal`, `ArtworkSelectorModal`, `VirtualKeyboardModal`, `Select`) operate strictly without mouse input (verified via synthetic gamepad & keyboard navigation tests).
  * [x] Seamless switching between Desktop Mode and Big Picture Mode preserves active game selection and library state without restarting.
  * [x] Stick drift below 15% deadzone clamped deterministically via unit tests.
  * [x] Glyphs switch cleanly between Xbox, PlayStation DualSense, and Keyboard prompts.
  * [ ] *Note*: Physical USB/Bluetooth controller hardware was unavailable in this environment; all hardware validation used Windows PnP checks + WebView2/Rust `gilrs` compilation + synthetic W3C Gamepad test suites.

---

### Phase 5 (5A–5I): Complete Gaming Management Features
* **Status**: Complete & Verified (Phases 5A–5I).
* **Goal**: Deliver deep gaming management features: ranked backlog queue, calendar planner, live session tracking with recovery, custom collections, gaming journal, honest statistics, wishlist improvements, comprehensive settings, and SQLite online backup/restore.
* **Key Tasks**:
  1. **Phase 5A: Backlog Prioritizer & Kanban Board**
     * Ranked queue view with drag-and-drop & controller Up/Down reordering (`POST /backlog/reorder`).
     * 4-lane Kanban Board view (Planned, Now Playing, On Hold, Completed) with quick status moves.
     * Backlog Priority, Target Dates, Custom Notes, Completion Goals.
     * "Set as Next Game" shortcut promoting titles to Position #1.
     * Connected "Up Next" carousel on Overview Dashboard.
  2. **Phase 5B: Gaming Planner & Calendar**
     * Schedule & Timeline views for upcoming gaming sessions (`/planner/sessions`).
     * Session creation with conflict detection and overlapping time alerts.
     * Support for repeat rules (Weekly, Daily, Custom).
     * Windows app lifecycle disclaimer for notifications when closed.
  3. **Phase 5C: Play Session Tracking & Live HUD**
     * Floating Live HUD overlay with real-time ticker, Pause/Resume/End controls.
     * Automatic unfinalized session recovery modal after app restart or unexpected exit.
     * Manual session duration and notes logging.
     * Honest cumulative hours aggregation without mock telemetry.
  4. **Phase 5D: Collections & Franchise Management**
     * Custom playlists with custom cover/banner URLs and ordered items (`/collections`).
     * Franchise organization with custom play order (`/franchises/{id}/games`).
     * Cascade protection: deleting collections preserves underlying library entries.
  5. **Phase 5E: Gaming Journal**
     * Game-specific and global journal entries with milestone tagging and personal ratings (`/journal`).
     * Spoiler protection with click/button to reveal blurred text.
     * Seamless integration into Game Details "Notes & Journal" tab.
  6. **Phase 5F: Gaming Statistics Engine**
     * Honest metrics: status breakdown, monthly gaming trends, platform distribution, most played titles.
     * Full-year 365-day activity heatmap grid.
     * Hours by Genre bar chart with explicit multi-genre disclaimer (no double-counting inflation).
  7. **Phase 5G: Wishlist Improvements**
     * Store preferences, target prices with localized currency formatting (INR/USD/EUR).
     * "Mark as Purchased" and "Move to Backlog" workflows with platform and playing status selection.
  8. **Phase 5H: Complete Application Settings**
     * Tabbed configuration interface: Appearance (accent theme), Performance (FPS/animations), Controller, Notifications, Integrations & API credentials, Storage & Cache diagnostics, and About.
     * Windows DPAPI / Credential Manager integration for secure API key storage.
  9. **Phase 5I: Database Backup & Restore**
     * Non-blocking WAL-safe online snapshot via `sqlite3.Connection.backup()` (`POST /system/backup`).
     * Restore workflow with automatic pre-restore safety backup creation.
     * Portable JSON export/import (omitting credentials) and local image cache purger.
* **Acceptance Criteria**:
  * [x] Alembic migration `a1b2c3d4e5f6_phase5_gaming_management.py` applies cleanly on existing and new databases.
  * [x] Pytest backend suite passes with 24/24 green tests across all Phase 5 models, services, and endpoints.
  * [x] Frontend unit tests pass with 9/9 green tests, TypeScript strict checks with 0 errors, and ESLint with 0 warnings.
  * [x] Big Picture Mode navigation (`/big-picture`) and desktop navigation verified across all new Phase 5 views.
  * [x] E2E visual verification completed via headless browser across all 9 views with evidence screenshots logged.

---

---

### Phase 6 (6A–6H): Steam Integration, Automation & Windows Release
* **Status**: Complete & Verified (Phases 6A–6H).
* **Goal**: Deliver deep Steam ecosystem integration, multi-drive game detection, native process playtime tracking, executable launcher, real-time wishlist deals, and release installer.
* **Key Tasks**:
  1. **Phase 6A: Steam Account Integration**
     * Steam ID64 & Vanity URL profile resolution.
     * Valve Steam Web API connection test & status probe.
     * Profile privacy detection (public vs. private/friends-only) with helpful user alerts.
     * Windows DPAPI credential protection for Steam Web API keys.
  2. **Phase 6B: Steam Library Synchronization**
     * Catalog retrieval via `GetOwnedGames` & `GetRecentlyPlayedGames`.
     * Multi-tiered matching engine aligning Steam App IDs to IGDB canonical records.
     * 3-category import preview modal (*New*, *Existing in Library*, *Unmatched*).
     * Selective batch import with progress reporting.
     * Steam Family Sharing support without overriding ownership tags.
     * Strict decoupled preservation of user-entered ratings, personal playtime, and custom notes.
  3. **Phase 6C: Steam Achievement Tracking**
     * Live retrieval of schemas and player unlock status via `GetSchemaForGame` and `GetPlayerAchievements`.
     * Global unlock percentages via `GetGlobalAchievementPercentagesForApp` for rarity tags (*Common*, *Rare*, *Ultra Rare*).
     * Dedicated Achievements tab on Game Details view with unlock filter, search, sorting, and spoiler blur/reveal.
     * Automatic 100% completion suggestion upon unlocking all achievements, preserving user choice.
  4. **Phase 6D: Automatic Gameplay Detection**
     * Multi-drive Steam installation scanning via VDF parsing of `libraryfolders.vdf`.
     * Manifest parser for `appmanifest_{appid}.acf` resolving install state, build IDs, and game directories.
     * Native background process polling via `psutil` matching running game executables.
     * Explicit exclusion list filtering out launchers, crash handlers, anti-cheat services, and helper daemons.
     * Automated play session start, heartbeat tracking, and graceful finalization with pause and crash recovery.
  5. **Phase 6E: Game Launcher Engine**
     * Rust Tauri IPC commands for `launch_steam_game` (`steam://rungameid/<id>`) and `launch_executable`.
     * Security path validation enforcing `.exe` extensions and strictly rejecting shell metacharacters (`&`, `|`, `;`, `>`, `<`, `` ` ``, `$`).
     * Direct "Play Game" action on Game Details view with optional auto-minimize and restore on exit.
  6. **Phase 6F: Wishlist Price Tracking**
     * Integrated IsThereAnyDeal (ITAD) API provider for real-time digital store deals and price cuts.
     * Regional currency support prioritizing Indian Rupee (INR) and user-selected localized currencies.
     * Real-time calculation of discount percentages, historical low prices, and target met alerts.
  7. **Phase 6G: Quality, Security & Performance Review**
     * Measured cold start, idle RAM, and minimized CPU resource footprints.
     * Verification of DPAPI secret encryption and zero-plain-text storage.
     * Complete suite verification: 29 backend tests, 9 frontend tests, 4 Rust tests.
  8. **Phase 6H: Windows Installer & Release V1.0.0**
     * Tauri 2.0 NSIS Windows installer bundling the compiled Python backend sidecar.
     * SHA-256 integrity verification and automated zero-dependency installation.
     * Full release documentation: `CHANGELOG.md`, `RELEASE_NOTES.md`, `USER_GUIDE.md`.
* **Acceptance Criteria**:
  * [x] Alembic migration `b2c3d4e5f6g7_phase6_steam_automation.py` applies cleanly on existing and new databases.
  * [x] Pytest backend suite passes with 29/29 green tests across all Phase 6 models, services, and endpoints.
  * [x] Frontend unit tests pass with 9/9 green tests, TypeScript strict checks with 0 errors, and ESLint with 0 warnings.
  * [x] Rust shell tests pass with 4/4 green tests.
  * [x] Full production build (`npm run build`) succeeds.
  * [x] PyInstaller standalone sidecar packaged and bundled into Tauri release installer.
