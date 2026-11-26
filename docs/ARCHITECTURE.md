# CHECKPOINT Gaming Hub — System Architecture Document

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Architecture Style:** Local-First Modular Monorepo with Tauri 2.0 Desktop Shell & Python/FastAPI Sidecar  

---

## 1. High-Level Architectural Overview

CHECKPOINT Gaming Hub utilizes a **three-tier local desktop architecture** designed for zero external cloud hosting, complete offline capability, and high-performance visual rendering on Windows:

```
+---------------------------------------------------------------------------------------+
|                                    TAURI 2.0 SHELL                                    |
|                                     (Rust Engine)                                     |
|  +-------------------------------------+    +--------------------------------------+  |
|  |  Windows WebView2 Host Frame        |    |  Sidecar Process Manager             |  |
|  |  - Native Titlebar & Window Chrome  |    |  - Spawns & monitors FastAPI child  |  |
|  |  - Fullscreen Big Picture Toggle    |    |  - Dynamic loopback port assignment  |  |
|  |  - Gamepad API & Gilrs Fallback     |    |  - Ephemeral handshake secret token  |  |
|  |  - Native File Dialogs (Backup)     |    |  - Graceful SIGTERM shutdown hook    |  |
|  +-------------------------------------+    +--------------------------------------+  |
+-------------------------------------------|-------------------------------------------+
                                            |
                         IPC / Webview      | Loopback HTTP (127.0.0.1:8765)
                                            v
+---------------------------------------------------------------------------------------+
|                                    FRONTEND LAYER                                     |
|                      (React 18/19 + TypeScript + Vite + Tailwind CSS)                 |
|  +---------------------------------------------------------------------------------+  |
|  | Presentation: Sora (Headings) + Inter (Body/Labels) + Stitch V2 Components      |  |
|  | State Architecture: Zustand (Gamepad, Theme/Accent, Views) + TanStack Query     |  |
|  | Spatial Engine: Gamepad Polling Loop, 2D Raycasting Nav, Virtual Keyboard      |  |
|  | Motion & Polish: Motion (Component Transitions) + GSAP (Cinematic Hero FX)      |  |
|  +---------------------------------------------------------------------------------+  |
+-------------------------------------------|-------------------------------------------+
                                            |
                                            | Async REST API Requests
                                            v
+---------------------------------------------------------------------------------------+
|                                    BACKEND SERVICE                                    |
|                          (Python 3.11+ / FastAPI / Uvicorn)                          |
|  +---------------------------------------------------------------------------------+  |
|  | REST API Router (Endpoints: /games, /library, /search, /artwork, /sessions...)  |  |
|  | External Services: HTTPX Async Clients -> IGDB API (Twitch OAuth) + SteamGridDB |  |
|  | Data Access: SQLAlchemy 2.0 (Async) + Alembic Migrations + Pydantic v2 Models   |  |
|  | Local Artwork Engine: Image download, SHA-256 deduplication, AppData cache     |  |
|  | Storage: Local SQLite Database (%APPDATA%/Checkpoint/checkpoint.db with WAL)   |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Technology Decisions & Rationale

| Layer | Selected Tech | Alternatives Evaluated | Rationale & Trade-offs |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | **Tauri 2.0 (Rust)** | Electron, Flutter Desktop, Qt | **Memory & Performance**: Tauri uses the native Windows WebView2 runtime, resulting in a ~40MB installer and <60MB idle memory footprint compared to Electron's 250MB+ bundled Chromium. Rust provides native process sandboxing and direct OS-level gamepad management. |
| **Frontend Framework** | **React + Vite + TypeScript** | SvelteKit, Vue 3, Next.js | **Ecosystem & Polish**: React provides rich animation support (Motion, GSAP), mature gamepad hooks, and direct compatibility with the Google Stitch V2 exported components. Vite enables <300ms HMR during development. |
| **Styling & Design Tokens** | **Tailwind CSS v3** | CSS Modules, Styled Components | **Design System Fidelity**: Stitch V2 design system uses Tailwind utilities. Custom design tokens (`accent-gold`, `surface-elevated`, `display-lg`, `duration-hero-transition`) map directly into `tailwind.config.ts`. |
| **State Management** | **Zustand + TanStack Query** | Redux Toolkit, MobX | **Separation of Concerns**: TanStack Query handles external and local server state (caching, background revalidation, mutation optimistic updates). Zustand manages high-frequency, non-persisted client state (active controller focus, analog stick delta, dynamic accent theme). |
| **Backend Framework** | **FastAPI + Uvicorn** | Node.js/Express, Go/Gin, Rust Axum | **Data Pipelines & Developer Velocity**: Python provides mature libraries for IGDB API wrapping, image verification, and future local AI game recommendation models. FastAPI provides auto-generated OpenAPI schemas, strict Pydantic validation, and high async throughput via `asyncio`. |
| **Persistence Engine** | **SQLite (via SQLAlchemy 2.0)** | PostgreSQL, DuckDB, Realm | **Local-First Simplicity**: SQLite requires zero installation by end-users, operates entirely within the Windows AppData directory, supports full ACID transactions via Write-Ahead Logging (`WAL`), and enables single-file user backups. |
| **Database Migrations** | **Alembic** | Raw SQL scripts, Prisma | **Schema Versioning**: Alembic tracks schema changes across versions cleanly, ensuring user databases migrate safely without data loss when upgrading CHECKPOINT. |
| **Controller Engine** | **Gamepad API + Gilrs (Rust fallback)** | SDL2 wrapper, Pure Win32 API | **Broad Compatibility**: Modern Chromium/WebView2 provides Web Gamepad API for direct XInput and DualSense polling at 60Hz. If a background window state or WebView limitation occurs, Tauri's Rust layer uses `gilrs` to pipe controller events via IPC. |

---

## 3. Monorepo Directory Organization

```
Checkpoint/
├── .gitignore                     # Protects secrets, build artifacts, databases, caches
├── README.md                      # Project overview and setup instructions
├── AGENTS.md                      # Persistent instructions for AI coding agents
├── docs/                          # Architectural and engineering specifications
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── CONTROLLER.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   └── ROADMAP.md
├── frontend/                      # React + TypeScript + Vite Desktop Client
│   ├── public/
│   │   ├── fonts/                 # Local Sora & Inter variable font files
│   │   └── glyphs/                # Controller button vector assets (A, B, X, Y, etc.)
│   ├── src/
│   │   ├── components/            # Atomic Stitch V2 UI components
│   │   │   ├── button/
│   │   │   ├── card/
│   │   │   ├── modal/
│   │   │   ├── tabs/
│   │   │   └── badge/
│   │   ├── features/              # Screen-specific feature modules
│   │   │   ├── dashboard/         # Screen 1: Overview Dashboard
│   │   │   ├── library/           # Screen 2: My Library (Grid, List, Cinema)
│   │   │   ├── discover/          # Screen 3: Discover & Search (IGDB split)
│   │   │   ├── modal-add/         # Screen 4: Add Game Modal
│   │   │   ├── game-details/      # Screen 5: Game Details Hub
│   │   │   └── big-picture/       # Screen 6: Big Picture Controller Mode
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useGamepad.ts      # Controller polling and button debounce
│   │   │   ├── useSpatialNav.ts   # 2D D-pad directional raycaster
│   │   │   └── useThemeAccent.ts  # Dynamic game-specific accent extractor
│   │   ├── stores/                # Zustand client stores
│   │   │   ├── gamepadStore.ts    # Active controller type, focused node, glyphs
│   │   │   ├── themeStore.ts      # Active background image, accent hex, brightness
│   │   │   └── libraryStore.ts    # Active view mode, filters, sort selections
│   │   ├── services/              # API Client (Axios / fetch wrappers)
│   │   │   ├── api.ts             # Base client with local security token injection
│   │   │   ├── gamesApi.ts
│   │   │   └── searchApi.ts
│   │   ├── types/                 # Shared TypeScript models and enums
│   │   ├── App.tsx                # Main router and viewport host
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.ts         # Stitch V2 tokens configuration
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── backend/                       # Python FastAPI Local Service
│   ├── .env                       # Pre-configured IGDB & SteamGridDB keys (DO NOT EXPOSE)
│   ├── .env.example               # Example template for clean development
│   ├── alembic/                   # Database migration environment
│   │   ├── versions/
│   │   └── env.py
│   ├── app/
│   │   ├── api/                   # REST API routers
│   │   │   ├── v1/
│   │   │   │   ├── games.py       # CRUD operations for library games
│   │   │   │   ├── search.py      # IGDB catalog queries
│   │   │   │   ├── artwork.py     # SteamGridDB fetching & image cache
│   │   │   │   ├── sessions.py    # Play session logs and notes
│   │   │   │   ├── collections.py # Custom collections & franchise groups
│   │   │   │   └── system.py      # Health check, backup, restore, settings
│   │   │   └── router.py
│   │   ├── core/                  # Core configurations
│   │   │   ├── config.py          # App settings (Pydantic BaseSettings)
│   │   │   ├── database.py        # Async SQLAlchemy engine & session factory
│   │   │   └── security.py        # Loopback secret handshake validator
│   │   ├── models/                # SQLAlchemy ORM database models
│   │   │   ├── game.py
│   │   │   ├── artwork.py
│   │   │   ├── session.py
│   │   │   └── collection.py
│   │   ├── schemas/               # Pydantic validation schemas
│   │   │   ├── game.py
│   │   │   ├── igdb.py
│   │   │   └── session.py
│   │   ├── services/              # Business logic & third-party integrations
│   │   │   ├── igdb_client.py     # Twitch OAuth token cache & query engine
│   │   │   ├── steamgriddb.py     # Grid, Hero, Logo asset downloader
│   │   │   ├── image_cache.py     # Local file caching & SHA-256 management
│   │   │   └── backup.py          # SQLite export/import manager
│   │   └── main.py                # FastAPI initialization and lifecycle hooks
│   ├── tests/                     # Pytest suite
│   ├── pyproject.toml
│   └── alembic.ini
└── src-tauri/                     # Tauri 2.0 Rust Desktop Shell
    ├── src/
    │   ├── lib.rs                 # Tauri setup and window initialization
    │   ├── main.rs                # Tauri executable entry
    │   ├── sidecar.rs             # Subprocess launcher for Python backend
    │   └── gamepad.rs             # Gilrs native controller bridge (fallback)
    ├── icons/                     # Application icons (.ico, .png)
    ├── tauri.conf.json            # Tauri 2.0 window & security permissions
    └── Cargo.toml
```

---

## 4. Lifecycle & Process Communication Architecture

### 4.1 Development Lifecycle
1. Backend runs independently via Uvicorn: `uvicorn app.main:app --port 8765 --reload`.
2. Frontend runs via Vite dev server: `npm run dev` at `http://localhost:5173`.
3. Tauri runs in dev mode: `cargo tauri dev`, directing the native WebView2 window to `http://localhost:5173`.

### 4.2 Production Lifecycle (Packaged Distribution)
1. **Packaging**:
   * The Python backend is compiled into a standalone binary using PyInstaller (`checkpoint-backend.exe`).
   * The frontend is built into static HTML/JS/CSS assets (`frontend/dist/`).
   * Tauri bundles the compiled static assets and includes `checkpoint-backend.exe` as an external sidecar binary.
2. **Execution Sequence**:
   ```
   [User launches CHECKPOINT.exe]
               |
               v
   [Tauri Rust main()]
     ├── 1. Generates ephemeral UUID session token in memory.
     ├── 2. Finds an open loopback port (default 8765, or 8766-8799).
     ├── 3. Spawns sidecar `checkpoint-backend.exe` with CLI args:
     │      `--port 8765 --auth-token <ephemeral_token>`
     ├── 4. Polls `http://127.0.0.1:8765/api/v1/system/health` until ready (<800ms).
     ├── 5. Injects port and auth token into WebView2 initial window context.
     └── 6. Opens main application window (1280x1024 or fullscreen Big Picture).
               |
               v
   [User exits application]
     ├── Tauri captures window close event.
     ├── Sends SIGTERM to Python sidecar process.
     ├── Backend closes SQLite WAL file and flushes caches.
     └── Tauri terminates cleanly.
   ```

---

## 5. Storage & File System Architecture (Windows)

All persistent application data adheres strictly to Windows application conventions:

* **Database File**:  
  `%APPDATA%/Checkpoint/checkpoint.db` (SQLite 3 database with WAL journal mode).
* **Artwork Cache Directory**:  
  `%APPDATA%/Checkpoint/artwork_cache/`  
  * `covers/` (2:3 portrait grids, format: `<sha256_hash>.webp`)
  * `heroes/` (16:9 landscapes, format: `<sha256_hash>.webp`)
  * `logos/` (Transparent PNGs, format: `<sha256_hash>.png`)
* **Logs Directory**:  
  `%LOCALAPPDATA%/Checkpoint/logs/` (`backend.log`, `tauri.log`).
* **Backup Directory**:  
  User-selectable or `%USERPROFILE%/Documents/Checkpoint Backups/`.

---

## 6. Resilience & Fault Tolerance

1. **Backend Unavailability**:
   * If the local Python process crashes or fails to start, the frontend renders a dedicated "Service Offline" recovery dialog with a one-click restart trigger.
2. **Network Disconnection**:
   * All previously imported games, local notes, sessions, and cached artwork remain 100% accessible offline.
   * Search queries via IGDB gracefully display a "You are currently offline" banner without crashing the interface.
3. **Database Concurrency**:
   * SQLite WAL mode enables concurrent read access from multiple queries while background async tasks perform mutations without locking the user interface.
