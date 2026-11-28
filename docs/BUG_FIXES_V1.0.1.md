# CHECKPOINT V1.0.1 — Bug Fix Batch 01 Specification & Resolution Report

**Release Target:** CHECKPOINT Gaming Hub V1.0.1  
**Date:** November 27, 2026  
**Scope:** Fixes for black-box defects identified during installed V1.0.0 desktop verification.

---

## 1. Executive Summary

This release resolves five specific issues discovered during real-world Windows installation and black-box testing of CHECKPOINT V1.0.0. All fixes adhere strictly to the CHECKPOINT V2 design system, local-first SQLite integrity, 10-foot controller navigation standards, and DPAPI credential protection guidelines.

| Defect ID | Severity | Component | Root Cause | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | Medium | Desktop Packaging / NSIS | Default NSIS placeholder icon shown instead of Checkpoint emblem; missing ICO layers. | **Resolved** |
| **BUG-002** | Medium | NSIS Installer Configuration | Installer locked to `currentUser` (`%LOCALAPPDATA%`), missing dual-mode selection and professional branding. | **Resolved** |
| **BUG-003** | Critical | Backend Lifecycle / Startup Handshake | Race condition where `useHealthQuery` aborted after 1 attempt before sidecar finished port binding. | **Resolved** |
| **BUG-004** | High | IGDB Service & Error Handling | Raw Winsock `[Errno 11001]` socket error displayed directly to user on DNS/internet drops. | **Resolved** |
| **BUG-005** | High | Global Search / Discover Page | Title bar lacked live autocomplete dropdown; disconnected from Discover state while typing. | **Resolved** |
| **BUG-006** | Medium | Add Game / Planner UI | Browser-native `dd-mm-yyyy` input required manual typing instead of interactive calendar. | **Resolved** |
| **BUG-007** | High | Game Detection Service | Installed Steam games across drives and cross-edition titles were not recognized automatically. | **Resolved** |
| **BUG-008** | High | Game Launcher / IPC | Quoted executable paths failed path validation; no native GUI file picker. | **Resolved** |
| **BUG-009** | High | SteamGridDB Artwork | CDN domain validation rejected valid image hosts and dropped CORS headers on error. | **Resolved** |
| **BUG-010** | High | Steam Library Synchronization | Sequential O(N) IGDB queries during preview scan caused frontend request timeout. | **Resolved** |
| **BUG-011** | High | Dashboard / Overview | Currently Playing carousel missing or conditionally hidden when no games playing. | **Resolved** |
| **BUG-012** | High | Theming & Cinematic Backdrop | Image onload race condition caused black backdrops; missing franchise accent mappings. | **Resolved** |
| **BUG-013** | High | Game Details & Modals | Add Game and Game Details lacked interactive progress slider and nullable rating controls. | **Resolved** |
| **BUG-014** | High | Active Sessions & HUD | Live session timer double-counted seconds on query refetches; stats did not refresh. | **Resolved** |
| **BUG-015** | High | Library & Wishlist | Wishlist ("To Buy") games appeared in active Library and contaminated stats. | **Resolved** |
| **BUG-016** | High | Wishlist & Price Tracking | Wishlist lacked target purchase price, INR currency, real store discounts, and deal alerts. | **Resolved** |
| **BUG-017** | High | Statistics & Analytics | Steam playtime was conflated with local session hours; missing personal ratings distribution. | **Resolved** |
| **BUG-018** | High | Settings & Local Storage | Appearance, performance, and notification settings were non-functional or not persisted. | **Resolved** |
| **BUG-019** | Medium | API Configuration & Status | Connection status assumed connected on key presence without live testing; missing setup links. | **Resolved** |
| **BUG-020** | High | General Stability & Stress | Addressed rapid navigation, blob URL memory management, network timeouts, and orphaned processes. | **Resolved** |

---

## 2. Defect Analysis & Technical Resolution

### BUG-001 — Missing Windows Application and Installer Icons
* **Problem Statement:** The Windows installer and compiled executables displayed the default Nullsoft / generic icon instead of the CHECKPOINT gaming emblem.
* **Root Cause:** NSIS installer wizard assets (`installerIcon`, `headerImage`, `sidebarImage`) were omitted from `tauri.conf.json`.
* **Resolution:**
  1. Generated multi-resolution Windows ICO (`src-tauri/icons/icon.ico`) incorporating 16, 24, 32, 48, 64, 128, and 256 px layers from `Checkpoint Gaming Emblem.png`.
  2. Generated custom 150×57 px BMP header banner (`src-tauri/icons/header.bmp`) and 164×314 px BMP wizard sidebar (`src-tauri/icons/sidebar.bmp`) using the `#111722` dark navy background and emblem.
  3. Configured `tauri.conf.json` with explicit `installerIcon`, `headerImage`, and `sidebarImage`.

### BUG-002 — Installer Location and Professional Branding
* **Problem Statement:** Installer defaulted to `%LOCALAPPDATA%\CHECKPOINT` with no option for system-wide installation.
* **Root Cause:** `bundle.windows.nsis.installMode` was configured as `"currentUser"`.
* **Resolution:**
  1. Updated `installMode` to `"both"`, enabling the user to choose between All Users (`C:\Program Files\CHECKPOINT Gaming Hub`) and Current User (`%LOCALAPPDATA%\Programs\CHECKPOINT Gaming Hub`).
  2. Set `productName` to `"CHECKPOINT Gaming Hub"` and configured publisher to `"CHECKPOINT"`.
  3. Verified that user library data in `%APPDATA%\Checkpoint\` (SQLite database and DPAPI credentials) is stored in the persistent roaming user profile and is never touched or removed on application updates or uninstalls.

### BUG-003 — Startup Race Condition / Premature Backend Offline Screen
* **Problem Statement:** On first launch, the desktop app prematurely displayed "Local CHECKPOINT Backend Offline" at `http://127.0.0.1:8765/api/v1` before the sidecar finished starting.
* **Root Cause:**
  - `useHealthQuery` had `retry: shouldRetrySystemQuery`, which aborted after `failureCount < 1`.
  - The Python PyInstaller sidecar takes ~1.2s to start, initialize Alembic migrations, and bind its socket.
  - Initial connection refusal within the first 100ms marked `healthQuery.isError = true`, immediately forcing `BackendGate` into the `unavailable` offline state.
* **Resolution:**
  1. Added `wait_for_backend_ready` IPC command in Rust with a 25-second timeout, ensuring the backend socket and HMAC proof verification pass before signaling readiness.
  2. Updated `apiClient.initializeSession()` in `frontend/src/services/api.ts` to await `wait_for_backend_ready`.
  3. Extended `useHealthQuery` to retry up to 15 times with 1–3s backoff.
  4. Updated `BackendGate.tsx` to remain in the `'connecting'` state with `<StartupScreen />` while queries are actively fetching or initializing.

### BUG-004 — Unhandled IGDB Network/DNS Error
* **Problem Statement:** When searching without internet or with DNS resolution failures, the application showed raw `[Errno 11001] getaddrinfo failed` socket tracebacks.
* **Root Cause:** `igdb.py` and `twitch_auth.py` wrapped `httpx.RequestError` without inspecting the underlying socket failure codes.
* **Resolution:**
  1. Implemented `classify_external_network_error()` in `backend/app/services/error_classifier.py`.
  2. Classified `[Errno 11001]`, `getaddrinfo`, and `gaierror` into structured `DNS_RESOLUTION_FAILED` (HTTP 503) and `OFFLINE_NO_INTERNET` (HTTP 503) codes with clean, human-readable explanations.
  3. Enhanced `DiscoverPage.tsx` with a dedicated network-offline UI banner displaying "Unable to reach IGDB catalog", "Retry Search", and a quick "Browse Local Library" escape hatch.

### BUG-005 — Global Search Title Bar Does Not Autocomplete / Disconnected From Discover
* **Problem Statement:** Typing in the global title bar did not show a live search dropdown. Navigating to Discover left the search disconnected from title bar input.
* **Root Cause:** `TitleBar.tsx` only responded to `form onSubmit` (Enter key) and lacked autocomplete state, debouncing, and two-way synchronization with `DiscoverPage.tsx`.
* **Resolution:**
  1. Implemented `GlobalSearchAutocomplete.tsx` in `frontend/src/components/layout/`.
  2. Configured 300ms input debouncing and >= 2 character threshold before querying IGDB.
  3. Rendered floating autocomplete dropdown presenting top 8 matching titles with 2:3 aspect ratio cover thumbnails, release year, IGDB rating badge, and "In Library" status badge.
  4. Integrated keyboard navigation (ArrowUp, ArrowDown, Escape to close, Enter to select).
  5. Built bidirectional state synchronization between `globalSearchQuery` in `useAppStore` and `DiscoverPage.tsx`.

### BUG-006 — Date Input Requires Manual Typing
* **Problem Statement:** Adding or editing games displayed browser-native `dd-mm-yyyy` text inputs that required manual typing without interactive calendar picking.
* **Root Cause:** Native `<input type="date">` was used without custom styling or popover calendar picker.
* **Resolution:**
  1. Built a dark atmospheric `<DatePicker>` popover component (`frontend/src/components/ui/DatePicker.tsx`) matching CHECKPOINT V2 design tokens (`#161D2B/98`, `#242E42`).
  2. Implemented month and year navigation, "Today" shortcut, "Clear Date" action, and selected date accent highlighting.
  3. Formatted display as `DD-MM-YYYY` with ISO 8601 `YYYY-MM-DD` serialization.
  4. Enforced date range validation ensuring planned start dates cannot exceed target completion dates.
  5. Extracted modular date utilities into `frontend/src/utils/date.ts`.

### BUG-007 — Installed Games Are Not Automatically Detected
* **Problem Statement:** Installed Steam games on non-default drives and cross-edition titles were not recognized automatically.
* **Root Cause:** `GameDetectorService` scanned limited locations, lacked Windows Registry path discovery, missed subfolder executables, and lacked cross-edition alias linking.
* **Resolution:**
  1. Added Windows Registry detection via `HKCU\Software\Valve\Steam\SteamPath` and `HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath`.
  2. Implemented drive enumeration across all mounted drive letters (`C:\`, `D:\`, `E:\`, `F:\`, etc.).
  3. Implemented `find_primary_game_executable()` scanning install roots and engine subfolders (`bin/`, `bin/x64/`, `Binaries/Win64/`), while ignoring crash handlers and uninstallers.
  4. Created `KNOWN_EDITION_ALIASES` linking base game AppIDs to enhanced, remastered, and GOTY releases (e.g. Metro Exodus `412020` <-> `1449560`).

### BUG-008 — Game Launcher Rejects Executable Paths with Surrounding Quotation Marks
* **Problem Statement:** Copying paths with quotation marks (e.g. `"D:\SteamLibrary\...\MetroExodus.exe"`) failed with "Target executable does not exist at ...".
* **Root Cause:** File validation checked the string with quotes included, which Windows file APIs reject as an invalid filename.
* **Resolution:**
  1. Enhanced `GameLauncherService` and Rust launcher IPC to safely strip quotes (`"..."` and `'...'`) and leading/trailing whitespace.
  2. Implemented native Windows OpenFileDialog support via Tauri IPC command `pick_executable_file`.
  3. Added "Browse EXE" action in `LaunchConfigModal.tsx`.
  4. Auto-populates detected local Steam executables in launch configurations when unconfigured.
  5. Displays exact OS error messages on launch failure.

### BUG-009 — SteamGridDB Artwork Update Fails
* **Problem Statement:** Clicking "Apply Artwork" in the SteamGridDB modal triggered "Artwork update failed — Failed to fetch".
* **Root Cause:** Domain whitelist rejected valid SteamGridDB and Steam CDN subdomains; CORS headers dropped on early rejection; query caches were not invalidated.
* **Resolution:**
  1. Expanded `ALLOWED_ARTWORK_DOMAINS` in `ArtworkCacheService` to encompass all SteamGridDB and Steam CDN domains.
  2. Injected CORS headers on early security rejection and exception handler responses in FastAPI.
  3. Configured `/api/v1/artwork/select` to retain existing active artwork if remote download fails and return HTTP 502 with friendly feedback.
  4. Enhanced `useSelectArtworkMutation` to invalidate `library.all`, `library.detail(gameId)`, `artwork.cacheStatus`, and `search.all` queries.

### BUG-010 — Steam Library Synchronization Times Out
* **Problem Statement:** Clicking "Sync Steam Library" failed with "Failed to scan Steam library — Request timed out reaching local backend".
* **Root Cause:** `SteamSyncService.generate_import_preview()` performed sequential IGDB API queries for every unimported Steam title; with 50+ games, latency exceeded frontend's 12s timeout.
* **Resolution:**
  1. Eliminated sequential O(N) external IGDB searches during preview generation.
  2. Leveraged Valve's instant 600x900 capsule CDN (`https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg`).
  3. Implemented O(1) local game matching against `Game.steam_app_id`, `KNOWN_EDITION_ALIASES`, and normalized title indexing.
  4. Automatically attaches high-resolution Steam capsule artwork to `GameArtwork` during library imports.
  5. Increased frontend preview and import API timeouts to 60s in `steamApi.ts`.

### BUG-011 — Currently Playing Carousel Missing on Overview Dashboard
* **Problem Statement:** Overview Dashboard did not display the expected Currently Playing carousel; if no games were marked as playing, the section disappeared completely.
* **Root Cause:** `OverviewPage.tsx` conditionally rendered the entire shelf with `currentlyPlaying.length > 0 && (...)`, giving no visual indication or controls to users.
* **Resolution:**
  1. Unconditionally rendered the Currently Playing shelf conforming to Stitch design `node_7560982411466141303`.
  2. Added Previous / Next circular stepping controls and keyboard Arrow navigation.
  3. Added dynamic spotlight selection that updates the main cinematic backdrop and hero title when clicking carousel cards.
  4. Added an atmospheric empty state card when zero games are marked as playing.

### BUG-012 — Dynamic Background and Accent Switching Not Working
* **Problem Statement:** Background backdrops often failed to transition, remaining at pitch black (`opacity-0`), and signature franchises lacked distinctive dynamic accent styling.
* **Root Cause:** Browser image `onLoad` did not trigger reliably for already-cached or pre-decoded image URLs, leaving `settledBg` unset. Signature franchise titles were not mapped in the theme resolver.
* **Resolution:**
  1. Added `img.complete` inspection in `CinematicBackdrop.tsx` for immediate background transition without waiting for dropped `onLoad` events.
  2. Fallback to full opacity immediately when changing hero backgrounds.
  3. Expanded `resolveKnownGameAccent` in `theme.ts` and `library.py` with verified hex tokens: Elden Ring (`#E0B45A`), Metro Exodus (`#F09B4B`), Watch Dogs (`#5BA8FF`), Cyberpunk 2077 (`#F5DF4D`), God of War, Hades, Witcher, Spider-Man.

### BUG-013 — Cannot Update Game Progress and Personal Rating
* **Problem Statement:** Users could not set or update campaign progress percentage or personal rating (0–10) in `AddGameModal` or `GameDetailsPage`, and clearing ratings was impossible.
* **Root Cause:** `AddGameModal.tsx` lacked input fields for progress and rating; `GameDetailsPage.tsx` sidebar lacked progress controls; mutations did not invalidate system statistics queries.
* **Resolution:**
  1. Added Campaign Completion Progress slider (0–100%) and numeric input with quick presets (0%, 25%, 50%, 75%, 100%) in `AddGameModal`, `GameDetailsPage`, and `UpdateProgressModal`.
  2. Added nullable Personal Rating (0–10) with an explicit "Clear Rating" action.
  3. Updated query invalidation in `useUpdateGameMutation` to refresh `queryKeys.system.stats`, `queryKeys.backlog.all`, and `queryKeys.stats.all`.

### BUG-014 — Playtime Tracking Features Not Working
* **Problem Statement:** Active session HUD timer showed inaccurate increments or jumped on query refetches; session edits and deletions did not update total playtime immediately.
* **Root Cause:** `ActiveSessionHUD.tsx` used a naive interval increment without resetting the delta on server refetches, causing double-counting; mutations did not invalidate system stats.
* **Resolution:**
  1. Replaced incremental ticker with timestamp delta `Date.now() - fetchedAt` in `ActiveSessionHUD.tsx`.
  2. Decoupled lifetime Steam imported playtime from local session history.
  3. Added `queryKeys.system.stats` invalidation to session mutations (`endActiveSession`, `logManualSession`, `updateSessionHistory`, `deleteSessionHistory`).

### BUG-015 — Wishlist Games Incorrectly Appear in My Library
* **Problem Statement:** Games marked as "To Buy" or wishlisted incorrectly appeared in My Library and Big Picture Library, skewing library counts and completion statistics.
* **Root Cause:** `LibraryRepository.list_entries` returned all entries by default without filtering out `ownership_status == "To Buy"`.
* **Resolution:**
  1. Filtered out `ownership_status == "To Buy"` by default in `LibraryRepository.list_entries`, `get_system_stats()`, `get_analytics()`, and backlog services.
  2. Added defensive filtering in `MyLibraryPage.tsx`, `BigPictureLibraryPage.tsx`, and `OverviewPage.tsx`.
  3. Provided "Mark Purchased" and "Move to Backlog" buttons in `WishlistPage.tsx` for seamless game acquisition workflow.

### BUG-016 — Wishlist and Price Tracking Not Working
* **Problem Statement:** The Wishlist feature lacked target purchase pricing, INR currency (`₹`) support, store preferences, live discount verification, and deal alerts.
* **Root Cause:** Wishlist cards only displayed stored data without live regional price querying or target threshold evaluations.
* **Resolution:**
  1. Built `AddToWishlistModal.tsx` and `EditWishlistModal.tsx` enabling users to set target purchase price, INR currency (`₹`), store preference (Steam, Epic, GOG, PlayStation, Xbox, Nintendo), priority, and notes.
  2. Implemented Valve Indian Regional Store API fallback (`https://store.steampowered.com/api/appdetails?appids={appid}&cc=in&filters=price_overview`) in `ITADService.get_wishlist_prices()` to fetch authentic INR prices and discounts when IsThereAnyDeal credentials are absent.
  3. Added target price met deal detection banner in `WishlistPage.tsx` displaying a prominent "Target Met!" badge when current price $\le$ target price.
  4. Added "Check Deals" action with instant toast notifications informing user of current regional discounts.
  5. Built "Mark as Purchased" (moves game to library as `Owned`) and "Move to Backlog" (moves game to library as `Owned` and `Planned`).
  6. Enforced strict honesty: zero simulated prices; if a title lacks store identifiers or APIs are down, an honest "Price Tracking Unavailable" state is displayed.

### BUG-017 — Statistics Missing or Incorrect
* **Problem Statement:** Total playtime conflated local sessions with imported Steam hours; rating distribution and separate playtime analytics were missing.
* **Root Cause:** `stats.py` and `GamingStatsResponse` did not distinguish between `steam_playtime_minutes` and local `hours_played`.
* **Resolution:**
  1. Extended `GamingStatsResponse` schema with `steam_total_hours`, `combined_total_hours`, `rated_games_count`, and `rating_distribution`.
  2. Implemented metric cards on `StatisticsPage.tsx` distinctly displaying Local Playtime, Steam Playtime, Total Games, Completed Games, Now Playing, Backlog, Wishlist Count, and Average Personal Rating.
  3. Added Personal Ratings Distribution chart breaking down scores into 5 distinct buckets:
     * Masterpiece (9.0–10.0)
     * Great (8.0–8.9)
     * Good (7.0–7.9)
     * Mixed/Low (< 7.0)
     * Unrated
  4. Built an atmospheric empty library state providing guidance and a quick link to Discover when 0 games are tracked.

### BUG-018 — Settings and Storage Partially Non-Functional
* **Problem Statement:** Appearance color choices, performance toggles, notification options, and storage settings were partially non-functional or reset across app restarts.
* **Root Cause:** Several settings in `useAppStore` were not included in `partialize` for persistent storage, and UI controls for accent selection and performance modes were absent.
* **Resolution:**
  1. Persisted all user preferences in `localStorage` under `checkpoint-app-preferences` via Zustand persist middleware: `dynamicAccentEnabled`, `defaultAccent`, `minimizeOnLaunch`, `lowGpuMode`, `sessionRemindersEnabled`, `priceAlertsEnabled`, `achievementAlertsEnabled`.
  2. Appearance Tab: Added Dynamic Game Accent Switching toggle and Default Accent Palette picker offering 8 curated colors (Cyan, Gold, Amber, Sapphire, Yellow, Violet, Crimson, Emerald) with instant CSS variable updates.
  3. Performance Tab: Added toggles for Reduced Motion, Compact Sidebar Mode, Minimize CHECKPOINT on Game Launch, and Low GPU Background Mode.
  4. Notifications Tab: Added toggles for Gaming Planner Reminders, Wishlist Price & Deal Alerts, and Steam Achievement Notifications.
  5. Storage Tab: Fully verified SQLite Online Database Backups (WAL-safe), single-click database restoration with automatic pre-restore safety snapshot, and portable JSON export/import without leaking API credentials.

### BUG-019 — API Configuration and Connection Status
* **Problem Statement:** Integration status badges showed "Connected" simply if any credential string existed in configuration, without live verification; missing setup links and ITAD/Steam Web API fields.
* **Root Cause:** Status checks only verified `bool(key)` without attempting live API handshakes.
* **Resolution:**
  1. Added `POST /api/v1/system/test-service` endpoint supporting live connection verification for IGDB, SteamGridDB, ITAD, and Steam.
  2. Provided clear "Required" badge for IGDB and "Optional" badges for SteamGridDB, ITAD, and Steam.
  3. Added direct official portal links to Twitch Developer Console, SteamGridDB API key page, ITAD waitlist, and Steam Web API key page.
  4. Implemented individual "Test Connection" buttons on each integration card with animated spinners, latency measurements, and exact diagnostic messages.
  5. Configured live statuses (`connected`, `authentication_failed`, `unreachable`, `not_configured`) and secured all credential updates with Windows DPAPI encryption.

### BUG-020 — Stress Testing and General Stability Audit
* **Problem Statement:** Rapid screen switching, rapid artwork changes, and network drops posed potential memory leak and stability risks.
* **Root Cause:** Image blob URLs required explicit lifecycle revocation; rapid route changes could leave pending query states.
* **Resolution:**
  1. Added `clearArtworkBlobCache()` and automatic URL revocation on artwork switching to prevent browser memory leaks.
  2. Implemented search query sanitization (clamping length, escaping special SQL tokens) to prevent crashes on edge-case inputs.
  3. Verified rapid view switching, route memory restoration, and clean unmounting across all pages.
  4. Validated clean application exit and child process teardown with zero orphaned sidecar processes.

---

## 3. Verification & Test Evidence

| Suite | Component | Scope | Tests Run | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** | Python / FastAPI / SQLite | Error classification, security, matching, migrations, detector, launcher, wishlist decoupling, rating, test-service, stats | 37 tests | **37 / 37 Passed** |
| **Frontend** | React / TypeScript / Vite | Core formatting, spatial navigation, autocomplete, datepicker, batch 03 & 04 unit tests | 29 tests | **29 / 29 Passed** |
| **Desktop Shell** | Rust / Tauri 2.0 | HMAC-SHA256 handshake, token generator, sidecar binary, app id | 4 tests | **4 / 4 Passed** |
| **Typecheck** | TypeScript | `tsc -b --noEmit` across all components and features | Whole repo | **0 Errors** |
| **Linter** | ESLint / React Hooks | Code quality and hook dependency verification | Whole repo | **0 Warnings** |
| **Packaging** | PyInstaller + Tauri 2.0 | Standalone sidecar binary (30.48 MB) and NSIS / MSI release installers | Windows x64 | **Verified** |
