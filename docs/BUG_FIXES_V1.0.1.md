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

---

## 3. Verification & Test Evidence

| Suite | Component | Scope | Tests Run | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** | Python / FastAPI / SQLite | Error classification, security, matching, migrations | 32 tests | **32 / 32 Passed** |
| **Frontend** | React / TypeScript / Vite | Core formatting, spatial navigation, autocomplete | 12 tests | **12 / 12 Passed** |
| **Desktop Shell** | Rust / Tauri 2.0 | HMAC-SHA256 handshake, token generator, sidecar binary | 4 tests | **4 / 4 Passed** |
| **Typecheck** | TypeScript | `tsc -b --noEmit` across all components and features | Whole repo | **0 Errors** |
| **Linter** | ESLint / React Hooks | Code quality and hook dependency verification | Whole repo | **0 Warnings** |
