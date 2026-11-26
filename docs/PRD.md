# CHECKPOINT Gaming Hub — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Target Platform:** Windows 10/11 (x64) Local-First Desktop Application  

---

## 1. Executive Summary & Vision

**CHECKPOINT Gaming Hub** is a premium, local-first personal gaming management application and 10-foot launcher interface designed for Windows. Modern gamers own titles across fragmented ecosystems (Steam, Epic Games Store, GOG Galaxy, Ubisoft Connect, EA App, PlayStation, Xbox, and emulation). Current solutions either resemble dense enterprise spreadsheets or intrusive commercial storefronts.

CHECKPOINT unifies a player's entire gaming life into an atmospheric, controller-first command center. Combining the visual richness of **PlayStation 5**, the full-bleed cover presentation of **Epic Games**, the decoupled multi-store tracking philosophy of **GOG Galaxy**, and the 10-foot couch-ready usability of **Steam Big Picture Mode**, CHECKPOINT delivers a cohesive, cinematic experience without cloud subscriptions, telemetry, or mandatory remote servers.

---

## 2. Core User Personas

1. **The Multi-Platform Enthusiast ("Kaelen")**: Owns 300+ games across Steam, GOG, and Epic. Wants an aggregated view with unified status tracking, independent of where the license was purchased.
2. **The Backlog Strategist**: Juggles multiple massive RPGs and narrative games. Needs completion target dates, goal modes (Main Story vs. 100%), and structured queue prioritization ("Up Next #1, #2, #3").
3. **The Couch & Handheld Player**: Plays on a TV-connected PC or gaming rig with an Xbox or PlayStation DualSense controller. Demands seamless D-Pad spatial navigation, zero reliance on a mouse cursor, and large, legible 10-foot typography.
4. **The Gaming Chronicler**: Enjoys recording journal notes on boss encounters, build choices, and playtime milestones, with historical session tracking.

---

## 3. Product Scope & Functional Requirements

### 3.1 Feature Classification (MVP vs. Future Phases)

| Feature Domain | Minimum Viable Product (MVP - Phases 1–4) | Future Enhancements (Phase 5+) |
| :--- | :--- | :--- |
| **Search & Metadata** | Dynamic IGDB search, full metadata import, genre/theme extraction | Community wiki scraping, automated metadata delta webhooks |
| **Artwork Management** | SteamGridDB 2:3 covers, 16:9 heroes, logos; local cache; manual replacement modal | Automated AI upscaling, animated WEBM/MP4 game covers |
| **Library Management** | Grid, List, and Cinematic views; multi-filter & multi-sort; card zoom slider | Duplicate detection across stores, tag auto-categorization |
| **Status Architecture** | Decoupled Playing Status vs. Ownership Status; custom priority levels | Multi-user profiles, shared household backlog rules |
| **Progress & Goals** | Progress % tracking, hours logged, completion modes (Story, Extras, 100%) | Steam Achievement live sync, automatic save-game parsing |
| **Journal & Notes** | Rich text game notes, date-stamped session logs, rating (0.0–10.0) | Screenshot gallery attachment from game directories |
| **Planning & Queue** | "Up Next" backlog queue, start/target completion dates, franchise grouping | Full interactive calendar view, Google/iCal export |
| **Collections & Wishlist** | Custom user collections, store wishlist tracking with target priority | IsThereAnyDeal live price tracking, discount notifications |
| **Statistics** | Overview completion rates, total hours, genre/platform breakdown charts | "Gaming Wrapped" annual retrospective, visual timelines |
| **Navigation & Modes** | Windowed Desktop Mode + Fullscreen Big Picture Controller Mode | Multi-monitor pinning, system tray minification |
| **Input Engine** | Xbox (XInput) & PlayStation (DualSense) gamepad navigation, A/B/X/Y glyphs | Custom button remapping profiles, gyro navigation |
| **Data & Storage** | Local SQLite, local artwork cache, manual JSON/SQLite backup & restore | Encrypted local backup, peer-to-peer LAN sync |
| **Execution** | Manual launch record / external link launcher | Process monitoring for automatic playtime detection |

---

### 3.2 Detailed MVP Functional Specifications

#### F-01: Global Metadata Retrieval (IGDB)
* The user can query any game via the search bar in `Discover & Search`.
* Queries hit the local backend, which searches the IGDB v4 API via Twitch OAuth token caching.
* Retrieved metadata includes: Canonical Title, Summary, Storyline, Release Dates, Developer(s), Publisher(s), Genres, Themes, Game Modes, Player Perspectives, Aggregated IGDB Critic/User Rating, and Franchise/Collection mapping.
* Games already in the local library display an active "In Library" state with a quick navigation link.

#### F-02: High-Resolution Artwork & SteamGridDB Asset Pipeline
* For any selected game, high-res assets are fetched via SteamGridDB API:
  * **Grids (Portrait)**: 2:3 vertical covers (minimum 600×900).
  * **Heroes (Landscape)**: 16:9 atmospheric backdrops (minimum 1920×1080).
  * **Logos**: Transparent PNG high-resolution official game logos.
* Assets are downloaded to the local Windows AppData cache directory (`%APPDATA%/Checkpoint/artwork_cache/`) with SHA-256 hashed filenames.
* The application provides an in-app **Artwork Selection Modal** allowing the user to select alternative covers or hero backgrounds directly from SteamGridDB.

#### F-03: Decoupled Playing vs. Ownership Architecture
Following GOG Galaxy’s architecture, licenses and playing states are strictly decoupled:
* **Playing Status**:
  * `Planned` (Backlog)
  * `Currently Playing`
  * `On Hold`
  * `Completed`
  * `100% Completed` (Platinum/All Achievements)
  * `Dropped`
* **Ownership Status**:
  * `Owned`
  * `Family Shared`
  * `To Buy` (Wishlist/Upcoming)
  * `Subscription` (Game Pass, EA Play, Ubisoft+, PS Plus)
* **Platforms Supported**: Steam, GOG, Epic Games Store, Xbox, PlayStation, Ubisoft Connect, EA App, Battle.net, Nintendo Switch, Other/Emulation.

#### F-04: Multi-View Library System
* **Cover Grid View**: Full-bleed 2:3 cards inspired by Epic Games and Steam. Hovering reveals platform ownership, hours logged, and completion state. Includes zoom slider for scaling card columns (2 to 6 columns).
* **Compact List View**: Dense, readable tabular presentation inspired by GOG Galaxy with sortable columns: Title, Platform, Playing Status, Progress %, and Hours Logged.
* **Cinematic View**: PlayStation 5-inspired hero showcase with the highlighted game expanding into a wide 16:9 banner with quick-action CTAs.
* **Filtering & Sorting**: Real-time filtering by status, platform, franchise, collection, and tags. Sorting by Recently Played, Alphabetical (A–Z), Progress %, and Priority.

#### F-05: Backlog Priority Queue & Franchise Sequencing
* Priority classification: `High`, `Medium`, `Low`.
* Backlog ranking queue (Queue #1, #2, #3...) featured on the Overview Dashboard "Up Next" carousel.
* Franchise grouping: Links titles within a common series (e.g., *The Witcher*, *Dark Souls*, *Kingdom Come*) and enables setting a chronological or custom playing order.

#### F-06: Goal Setting & Play Session Journaling
* **Completion Goal Types**:
  * `Main Story`: Core campaign completion estimate (sourced from HowLongToBeat / manual).
  * `Main + Side Quests`: Campaign plus major optional storylines.
  * `100% Completion`: All achievements, collectibles, and secret bosses.
* **Play Session Logger**: Allows manual entry of play sessions with date, time duration, milestone reached, and chapter/location name.
* **Gaming Journal**: Freeform markdown notes for builds, strategies, puzzle solutions, and personal post-game reflections.
* **Personal Rating**: Granular score on a 0.0 to 10.0 scale with review text.

#### F-07: Overview Dashboard Experience
* **Dynamic Atmospheric Hero**: The currently active title controls the screen's background art and adaptive accent color.
* **Currently Playing Carousel**: Quick 16:9 cards to hot-swap active titles with 500ms smooth crossfades.
* **Upcoming Schedule Shelf**: Cards displaying planned gaming sessions with timestamps.
* **Recently Completed Shelf**: Finished titles with completion date and personal rating badge.

#### F-08: Dual-Mode Operation (Desktop vs. Big Picture Controller Mode)
* **Desktop Mode**: Optimized for high-density mouse and keyboard navigation, window management (minimize/maximize/close), standard scrollbars, and compact controls.
* **Big Picture Mode**: Fullscreen 10-foot console experience. Replaces standard sidebars with top tab navigation, oversized carousel cards, 16:9 fullscreen artwork, and permanent controller glyph legends.
* Seamless transition between modes via keyboard shortcut (`F11` or `Ctrl+B`), UI button, or pressing the Gamepad Guide/Home button.

#### F-09: Universal Gamepad & Spatial Navigation Engine
* Compatible with Xbox (XInput), PlayStation 4/5 (DualShock/DualSense), and generic DirectInput gamepads via Web Gamepad API, with native Rust `gilrs` fallback.
* Hardware-level dead-zone calculation (15% default threshold) to prevent stick drift.
* Directional navigation (D-pad and Left Analog Stick) using spatial 2D geometric raycasting.
* Standardized button bindings:
  * `A` / `Cross`: Select / Confirm / Open Game
  * `B` / `Circle`: Back / Cancel / Dismiss Modal
  * `X` / `Square`: Update Progress / Quick Edit
  * `Y` / `Triangle`: Open Global Search
  * `LB` / `RB` (`L1` / `R1`): Cycle View Modes or Sub-Tabs
  * `LT` / `RT` (`L2` / `R2`): Fast Scroll / Page Up / Page Down
  * `Start` / `Options`: Open Context Menu
  * `Back` / `Select` / `Share`: Toggle Big Picture Mode

#### F-10: Local-First Storage, Backup & Restore
* Fully offline functional: Cached artwork and SQLite database require zero network connectivity after import.
* Export database and user journals to a single timestamped JSON or raw `.sqlite` backup file.
* Import/restore mechanism with schema migration safety checks.

---

## 4. Non-Functional Requirements (NFR)

### 4.1 Performance & Responsiveness
* **Cold Boot Time**: < 1.5 seconds to interactive dashboard.
* **Rendering Performance**: Locked 60 fps for all transitions, carousel scrolling, and modal animations.
* **Local API Latency**: < 50ms for library queries and local mutations.
* **Memory Footprint**: < 200MB resident memory in idle Desktop Mode; < 250MB in Big Picture Mode.

### 4.2 Data Integrity & Security
* Zero external telemetry, tracking scripts, or analytics beacons.
* API credentials (IGDB Client ID, Client Secret, SteamGridDB API key) stored exclusively in the local protected `.env` file or Windows Credential Manager.
* Local FastAPI backend bound strictly to `127.0.0.1` (loopback) with dynamic port assignment or shared secret header verification.

### 4.3 Accessibility & Comfort
* Full support for Windows High Contrast mode and WCAG AA contrast compliance (`#F4F7FC` text over `#111722` background provides > 13:1 contrast ratio).
* "Reduced Motion" setting to replace scale and translation transitions with simple crossfades.
* Adjustable card zoom scale to accommodate high-DPI displays and distance viewing on large TVs.

---

## 5. Design Tasks (Missing Stitch Screens to be Designed)

The existing Stitch project contains 6 core screens. The following complementary screens and components are identified as required design tasks:

| Screen / Component | Description | Reference Anchor | Priority |
| :--- | :--- | :--- | :--- |
| **Backlog Prioritization Board** | Kanban or drag-and-drop ranked list for organizing backlog queues | Sidebar $\rightarrow$ Backlog | High |
| **Gaming Planner & Calendar View** | Monthly and weekly calendar showing planned sessions and completion targets | Sidebar $\rightarrow$ Gaming Planner | High |
| **Wishlist & Price Tracking View** | Dedicated grid/list for unowned games with priority tags | Sidebar $\rightarrow$ Wishlist | Medium |
| **Collections Manager View** | Custom user-created groupings with cover banners and description headers | Sidebar $\rightarrow$ Collections | Medium |
| **Full Gaming Journal View** | Chronological log of all session entries across all games | Sidebar $\rightarrow$ Gaming Journal | Medium |
| **Comprehensive Statistics View** | Graphs of hours played, completion velocity, and platform distributions | Sidebar $\rightarrow$ Statistics | Medium |
| **Settings & Preferences View** | Settings for themes, controller deadzones, storage directories, backup/restore | Sidebar $\rightarrow$ Settings | High |
| **On-Screen Virtual Keyboard (OSK)**| 10-foot controller-navigable keyboard for Big Picture search/inputs | Big Picture Mode | High |
