# Automatic Updates & Release Engineering Architecture

**Document Version:** 1.1.0  
**Target:** Windows 10/11 Desktop (`x86_64-pc-windows-msvc`)  
**Components:** Tauri 2.0 Updater Plugin, Minisign Ed25519, GitHub Releases Distribution  

---

## 1. Overview & Security Mandate

CHECKPOINT Gaming Hub utilizes an automated, cryptographically signed update pipeline powered by the official **Tauri 2.0 Updater Plugin** (`tauri-plugin-updater` and `@tauri-apps/plugin-updater`).

### Core Design Principles:
1. **Local-First & Privacy Preserving**: Zero paid external telemetry or servers. Updates are checked directly against public GitHub Releases.
2. **Cryptographic Integrity (Minisign Ed25519)**: Every update archive and metadata manifest is signed using Ed25519 asymmetric cryptography. Tampered packages or invalid signatures are rejected automatically by the Tauri native updater before extraction.
3. **Safe Process Lifecycle Management**: Windows locks executables while running. CHECKPOINT executes a safe shutdown sequence (checking active game sessions, creating a pre-migration SQLite backup snapshot, and cleanly terminating the background Python sidecar process) before initiating installation.
4. **Non-Intrusive User Experience**: Background checks never interrupt gameplay. A non-modal indicator badge appears in the top navigation bar with full markdown release notes and download progress controls.

---

## 2. Cryptographic Signing Architecture

### Keypair Specification
- **Algorithm:** Ed25519 (via Minisign specification)
- **Private Key Storage:** Stored securely outside the git repository at `%USERPROFILE%/.tauri/checkpoint_updater.key`.
- **Public Key Configuration:** Configured in `src-tauri/tauri.conf.json`:
  ```json
  {
    "plugins": {
      "updater": {
        "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDJBNTE4QTk1RTIzRkI1MEIKUldUSXN3SmluR0Zic0R4R29hKzJ2dmxHNHR3MFFxR0ZzZFlxdXZtbm8vb2d2dWdCZnM5TXFnWGwK",
        "endpoints": [
          "https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/latest/download/latest.json"
        ]
      }
    }
  }
  ```

### Release Build Environment Variables
During release packaging, the Tauri CLI requires the following environment variables:
* `TAURI_SIGNING_PRIVATE_KEY`: Content or path of the Minisign private key.
* `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password protecting the private key (or empty string if created without passphrase).

When configured, Tauri automatically generates:
* `*.sig`: Detached base64 Minisign signatures for each installer bundle.
* `latest.json`: Update manifest linking version, release notes, release date, download URL, and signature.

---

## 3. Update Distribution Manifest Schema (`latest.json`)

The manifest is served statically from `https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/latest/download/latest.json`:

```json
{
  "version": "1.1.0",
  "notes": "CHECKPOINT Gaming Hub v1.1.0 — Cinematic UI V3 & Sound Experience",
  "pub_date": "2026-11-28T09:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/download/v1.1.0/CHECKPOINT_Gaming_Hub_1.1.0_x64-setup.nsis.zip"
    }
  }
}
```

---

## 4. Frontend Update Management & Zustand Store

### State Machine Architecture (`frontend/src/stores/updateStore.ts`)
```
[idle]
   │
   ├─► [checking] ──► [up-to-date]
   │       │
   │       ├─► [offline]
   │       │
   │       └─► [available]
   │                │
   │                ▼ (user clicks "Update Now" or auto-download)
   │           [downloading] (tracks speed & progress bytes)
   │                │
   │                ▼
   │           [verifying] (Minisign signature check)
   │                │
   │                ▼
   │           [installing] (safe sidecar shutdown & installer launch)
   │                │
   │                ▼
   │           [restart-required]
   │
   └─► [error] (with retry action)
```

### Safe Application Shutdown Sequence (`frontend/src/services/updateService.ts`)
1. **Active Gaming Guard**: Queries `/api/v1/sessions/active`. If a game session is active and `deferWhileGaming` is true, background checks delay notifying the user until gameplay ends.
2. **Pre-Update SQLite Backup**: Triggers `/api/v1/backup` via `backupApi.createBackup()` to generate an online WAL safety snapshot in `%APPDATA%/Checkpoint/backups/`.
3. **Sidecar Process Termination**: Invokes Tauri command `prepare_for_update` (`src-tauri/src/lib.rs`). This command signals `ProcessManager::stop_backend()` to stop `checkpoint-backend.exe` and release all Windows file locks on disk.
4. **Installer Execution**: Calls `update.install()`. The native Tauri updater launches the NSIS/MSI installer with elevation and closes the current application instance cleanly.

---

## 5. User Preferences & Settings

Managed in **Settings $\rightarrow$ Updates & Release** (`UpdateSettingsSection.tsx`):
* `autoCheck`: Automatically checks for updates on startup (after 4-second delay) and periodically.
* `checkIntervalHours`: Configurable interval (Startup only, 6 hours, 12 hours, 24 hours, 48 hours).
* `autoDownload`: Silently downloads update packages in the background when discovered.
* `notifyAvailable`: Displays notification indicator when a new release is available.
* `deferWhileGaming`: Suppresses update notifications and downloads while a game is actively running.
* `skipVersion(version)`: Allows the user to bypass a specific minor update if desired.
