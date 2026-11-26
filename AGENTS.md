# AGENTS.md — Persistent Agent Operating Guidelines

**Project:** CHECKPOINT Gaming Hub  
**Target Platform:** Windows 10/11 Desktop (Tauri 2.0 + React + FastAPI + SQLite)  
**Audience:** All Antigravity AI Agents working on this repository  

---

## 1. Prime Directives & Inviolable Rules

Every agent operating within this codebase must strictly adhere to these directives:

### Rule 1: Never Expose, Print, or Overwrite Secrets
* `backend/.env` is pre-configured with active IGDB and SteamGridDB credentials.
* **NEVER** run commands that dump, cat, or output `.env` contents to terminal logs or transcripts.
* **NEVER** overwrite, delete, or commit `.env`.
* If adding new environment variables, update `backend/.env.example` with placeholder strings.

### Rule 2: Visual Source of Truth (CHECKPOINT V2)
* The visual design system is defined in Google Stitch project `16645222145573679933` (Design System: `CHECKPOINT V2`).
* Do **NOT** replace designs with generic SaaS dashboards, white cards, or flat spreadsheet tables.
* Preserve atmospheric dark surfaces (`#111722` to `#2B384B`), Sora/Inter typography, dynamic game-specific accent colors, dual-direction gradient scrims, and full-bleed 2:3/16:9 artwork.

### Rule 3: 10-Foot Controller Accessibility
* Every interactive button, card, input, and tab must be spatial-navigation ready (`[data-nav-item="true"]`).
* Never implement mouse-only UI patterns without an equivalent controller/keyboard navigation path.
* Modals must enforce focus trapping and dismiss gracefully via gamepad `B` / `Circle`.

### Rule 4: Local-First & Privacy Architecture
* The application must run 100% locally on SQLite without requiring cloud accounts, external databases, or remote telemetry.
* All imported games and cached artwork in `%APPDATA%/Checkpoint/` must remain accessible offline.

### Rule 5: Honest Data Integrity
* Never fabricate mock playtime, ratings, or achievement synchronization.
* Playing Status and Ownership Status must remain decoupled as specified in `docs/PRD.md`.

---

## 2. Monorepo Architecture & File Boundaries

```
Checkpoint/
├── backend/       # Python FastAPI backend, SQLAlchemy 2.0 models, Alembic, IGDB/SteamGridDB services
├── frontend/      # React 18/19, TypeScript, Vite, Tailwind CSS, Zustand, Motion/GSAP, Gamepad hooks
├── src-tauri/     # Tauri 2.0 Rust desktop shell, window management, sidecar process manager, gilrs
└── docs/          # Canonical engineering specifications (PRD, ARCHITECTURE, DESIGN, etc.)
```

### Communication Boundary Rules:
* **Frontend $\rightarrow$ Backend**: All communication goes through the async HTTP REST client (`http://127.0.0.1:8765/api/v1`) with the `X-Checkpoint-Token` handshake header.
* **Tauri $\rightarrow$ Frontend**: Native desktop events (fullscreen, minimize, native gamepad events) are emitted via Tauri IPC channels.
* **Backend $\rightarrow$ Database**: Handled strictly via SQLAlchemy async sessions with WAL mode.

---

## 3. Engineering Workflows & Command Patterns

### Backend Development:
* Directory: `backend/`
* Activate virtual environment: `.\venv\Scripts\Activate.ps1` (or poetry shell)
* Run server: `uvicorn app.main:app --port 8765 --reload`
* Run tests: `pytest`
* Run migrations: `alembic upgrade head`
* Create migration: `alembic revision --autogenerate -m "description"`

### Frontend Development:
* Directory: `frontend/`
* Install dependencies: `npm install`
* Run dev server: `npm run dev`
* Run unit tests: `npm run test`
* Build production: `npm run build`

### Desktop Shell (Tauri):
* Root or `src-tauri/`
* Run desktop app in dev: `cargo tauri dev`
* Build Windows installer: `cargo tauri build`

---

## 4. Phase Execution Protocol

Agents must reference `docs/ROADMAP.md` before starting work:
* Do not jump ahead into future phases before current acceptance criteria are green.
* Verify unit and integration test passes before concluding any development turn.
* Document any new schema migrations in `docs/DATABASE.md` and new API endpoints in `docs/API.md`.
