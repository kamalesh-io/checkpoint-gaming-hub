# Changelog

All notable changes to **CHECKPOINT Gaming Hub** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-11-27

### Fixed
* **Windows Application & Installer Branding (BUG-001 & BUG-002)**:
  * Restored full multi-resolution Windows ICO assets (16x16 through 256x256) generated directly from the original Checkpoint emblem.
  * Added custom dark-themed NSIS wizard banners (`header.bmp` and `sidebar.bmp`) matching CHECKPOINT V2 `#111722` aesthetic.
  * Added dual-mode NSIS installation support allowing user selection between *All Users* (`C:\Program Files\CHECKPOINT Gaming Hub`) and *Current User* (`%LOCALAPPDATA%\Programs\CHECKPOINT Gaming Hub`).
  * Updated display name to `CHECKPOINT Gaming Hub` and configured publisher metadata to `CHECKPOINT`.
  * Verified persistent roaming user database and DPAPI credentials in `%APPDATA%\Checkpoint\` are never deleted during application upgrades or uninstallations.
* **Sidecar Startup Race Condition & Readiness Handshake (BUG-003)**:
  * Implemented `wait_for_backend_ready` in Rust IPC with a 25-second timeout, preventing premature frontend requests before port binding and HMAC proof verification complete.
  * Updated `apiClient.initializeSession()` to synchronously await backend readiness before initiating health queries.
  * Extended `useHealthQuery` to retry up to 15 times with 1–3s backoff during startup.
  * Guarded `BackendGate` to maintain `<StartupScreen />` throughout initial startup, eliminating premature "Local CHECKPOINT Backend Offline" warnings.
* **External Network & DNS Error Handling (BUG-004)**:
  * Implemented `classify_external_network_error()` in `error_classifier.py` mapping raw socket/Winsock errors (such as `[Errno 11001] getaddrinfo failed`) to structured `DNS_RESOLUTION_FAILED` and `OFFLINE_NO_INTERNET` codes.
  * Enhanced Discover page with a dedicated offline state banner with plain-language error guidance, a "Retry Search" button, and a "Browse Local Library" shortcut.
* **Title Bar Autocomplete & Discover Synchronization (BUG-005)**:
  * Created `GlobalSearchAutocomplete.tsx` featuring a Steam-style floating autocomplete dropdown with 300ms debouncing, minimum 2-character threshold, and top 8 matching titles with 2:3 thumbnails, release year, IGDB rating, and "In Library" status badge.
  * Implemented full keyboard navigation (ArrowUp, ArrowDown, Escape to dismiss, Enter to select).
  * Built seamless two-way state synchronization between `useAppStore.globalSearchQuery` and `DiscoverPage.tsx`.
* **Reusable CHECKPOINT V2 Calendar Date Picker (BUG-006)**:
  * Replaced native browser `dd-mm-yyyy` text inputs in `AddGameModal.tsx` and `GameDetailsPage.tsx` with a custom dark-atmospheric `<DatePicker>` popover component (`frontend/src/components/ui/DatePicker.tsx`).
  * Implemented month/year dropdown navigation, quick "Today" shortcut, "Clear Date" action, active day highlight with CHECKPOINT V2 tokens (`#161D2B/98`, `#242E42`), and `data-nav-item="true"` spatial navigation accessibility.
  * Enforced standard `DD-MM-YYYY` human display formatting alongside ISO 8601 (`YYYY-MM-DD`) internal serialization.
  * Enforced date range validation ensuring planned start dates cannot succeed target completion dates.
  * Extracted reusable date parsing and formatting utilities in `frontend/src/utils/date.ts`.
* **Automatic Steam Game Discovery & Cross-Edition Mapping (BUG-007)**:
  * Enhanced `GameDetectorService` with multi-tier installation scanning:
    * Windows Registry discovery (`HKCU\Software\Valve\Steam\SteamPath` and `HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath`).
    * Mounted drive scanning across all system drive letters (`C:\`, `D:\`, `E:\`, `F:\`, etc.).
    * VDF parsing across multi-drive Steam libraries in `libraryfolders.vdf`.
  * Added `find_primary_game_executable()` scanning both game install roots and engine subdirectories (`bin/`, `bin/x64/`, `Binaries/Win64/`, etc.), while filtering out crash handlers, uninstallers, and setup helpers.
  * Added `KNOWN_EDITION_ALIASES` mapping base games to enhanced, remastered, and GOTY releases (e.g. Metro Exodus `412020` <-> `1449560`, The Witcher 3 `292030` <-> `499450`, Skyrim `72850` <-> `489830`, Dark Souls II, Death Stranding, Bioshock).
* **Game Launcher Path Validation & Native Executable Picker (BUG-008)**:
  * Enhanced `GameLauncherService` and Tauri launcher IPC to safely strip surrounding quotation marks (`"..."` and `'...'`) and leading/trailing whitespace from executable paths.
  * Added native Windows OpenFileDialog support via Tauri IPC (`pick_executable_file`) with a "Browse EXE" button in `LaunchConfigModal.tsx`.
  * Auto-populates detected local Steam executables in launch configurations when unconfigured.
  * Displays explicit OS-level error details on launch failure instead of generic errors.
* **SteamGridDB Artwork Selection & Query Invalidation (BUG-009)**:
  * Expanded `ALLOWED_ARTWORK_DOMAINS` in `ArtworkCacheService` to encompass all SteamGridDB CDNs (`cdn2.steamgriddb.com`, `images.steamgriddb.com`, `media.steamgriddb.com`, `assets.steamgriddb.com`, `static.steamgriddb.com`) and Steam CDNs (`shared.steamstatic.com`, `cdn.steamstatic.com`, `media.steampowered.com`, `akamaihd.net`).
  * Added CORS headers to early error/handshake responses in `main.py` and `security.py`, preventing browser fetch rejection.
  * Configured `/api/v1/artwork/select` to retain existing active artwork if a remote download fails and return HTTP 502 with friendly feedback.
  * Enhanced `useSelectArtworkMutation` to invalidate `library.all`, `library.detail(gameId)`, `artwork.cacheStatus`, and `search.all` queries for instant UI refresh.
* **Steam Library Synchronization Optimization (BUG-010)**:
  * Eliminated the sequential O(N) external IGDB search bottleneck in `SteamSyncService.generate_import_preview()`.
  * Leveraged Valve's instant 600x900 capsule CDN (`https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg`) to generate preview artwork instantaneously.
  * Implemented O(1) local game matching against `Game.steam_app_id`, `KNOWN_EDITION_ALIASES`, and normalized title indexing.
  * Automatically attaches high-resolution Steam capsule artwork to `GameArtwork` during library imports.
  * Increased frontend preview and import API timeouts from 12s to 60s in `steamApi.ts`.
* **Currently Playing Carousel Restoration (BUG-011)**:
  * Restored the Currently Playing shelf on the Overview Dashboard matching Stitch design `node_7560982411466141303`.
  * Added circular carousel navigation controls (Previous/Next buttons, left/right keyboard arrows, controller D-pad/bumpers) with an active spotlight indicator badge.
  * Selecting any game in the carousel dynamically updates the main cinematic backdrop and hero spotlight.
  * Added an atmospheric empty state card when no games are currently marked as playing, guiding users to explore their library or discover new titles.
* **Dynamic Background & Franchise Accent Switching (BUG-012)**:
  * Fixed backdrop image loading race condition in `CinematicBackdrop.tsx` by verifying `img.complete` on image objects, preventing backdrops from getting stuck at `opacity-0` black screens.
  * Extended palette resolution in `theme.ts` and `library.py` to support signature franchise colors (Elden Ring `#E0B45A` / `accent-gold`, Metro Exodus `#F09B4B` / `accent-amber`, Watch Dogs `#5BA8FF` / `accent-blue`, Cyberpunk 2077 `#F5DF4D` / `accent-yellow`, God of War, Hades, Witcher).
* **Game Progress & Personal Rating Updates (BUG-013)**:
  * Implemented Campaign Completion Progress slider (0–100%) and nullable Personal Rating (0–10 with clear button) across `AddGameModal.tsx`, `GameDetailsPage.tsx` ("Your Journey" sidebar), and `UpdateProgressModal.tsx`.
  * Added quick progress milestone presets (0%, 25%, 50%, 75%, 100%) for one-click completion tracking.
  * Fixed query cache invalidation on rating and progress mutations to refresh system statistics, backlog views, and library entries immediately.
* **Playtime Tracking & Stats Synchronization (BUG-014)**:
  * Resolved live HUD timer calculation in `ActiveSessionHUD.tsx` using timestamp delta (`Date.now() - fetchedAt`), preventing timer double-counting or skipping on background server refetches.
  * Decoupled lifetime Steam imported playtime from local CHECKPOINT active gaming sessions.
  * Guaranteed immediate system statistics updates upon session completion, manual session logging, edits, and deletions via query invalidation.
* **Library & Wishlist Decoupling (BUG-015)**:
  * Filtered out `ownership_status == "To Buy"` from default library queries in `LibraryRepository.list_entries` and frontend views (`MyLibraryPage`, `BigPictureLibraryPage`, and `OverviewPage`).
  * Updated system stats, analytics, and backlog calculations to strictly exclude wishlist items from total games, completed games, and playtime metrics.
  * Enhanced `WishlistPage.tsx` with dedicated "Mark Purchased" and "Move to Backlog" actions for seamless conversion when games are acquired.

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
