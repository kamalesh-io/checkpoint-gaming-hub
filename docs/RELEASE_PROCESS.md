# CHECKPOINT Release Engineering Standard Operating Procedure (SOP)

**Purpose:** Standardized workflow for tagging, building, signing, and distributing official releases of CHECKPOINT Gaming Hub.

---

## 1. Pre-Release Quality Checklist

Before tagging any release, verify all automated test suites pass with zero warnings:

```powershell
# 1. Backend Pytest Suite
backend\.venv\Scripts\pytest.exe backend/tests/

# 2. Frontend Unit & Integration Suite
npm --prefix frontend test

# 3. Frontend TypeScript & Production Vite Build
npm --prefix frontend run build

# 4. Tauri Rust Shell Test Suite
cargo test --manifest-path src-tauri/Cargo.toml
```

Acceptance criteria:
* Backend: All tests green (`39/39`).
* Frontend: All tests green (`39/39`).
* Rust: All unit tests green (`4/4`).
* TypeScript: 0 type errors.

---

## 2. Version Bump Locations

Ensure semantic versions match across all configuration manifests:
1. `backend/app/__init__.py`: `__version__ = "1.1.0"`
2. `frontend/package.json`: `"version": "1.1.0"`
3. `src-tauri/Cargo.toml`: `version = "1.1.0"`
4. `src-tauri/tauri.conf.json`: `"version": "1.1.0"`

---

## 3. Local Release Build & Signing

To produce signed Windows installers and updater bundles on a development machine:

```powershell
# Step 1: Compile Python backend sidecar
python backend/build_sidecar.py

# Step 2: Set signing key environment variables
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\checkpoint_updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

# Step 3: Run Tauri production bundle
node frontend/node_modules/@tauri-apps/cli/tauri.js build
```

Generated artifacts located in `src-tauri/target/release/bundle/`:
* `nsis/CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe` (Main setup installer)
* `nsis/CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe.sig` (Detached Ed25519 signature)
* `msi/CHECKPOINT Gaming Hub_1.1.0_x64_en-US.msi` (MSI enterprise installer)
* `latest.json` (Updater manifest linking binary URL and signature)

---

## 4. GitHub Actions Automated Release Pipeline

When pushing a semantic version tag to GitHub:

```bash
git tag -a v1.1.0 -m "Release v1.1.0 — Cinematic UI V3 & Sound Experience"
git push origin v1.1.0
```

The GitHub Actions workflow (`.github/workflows/release.yml`) automatically:
1. Runs backend, frontend, and Rust test matrices.
2. Compiles the PyInstaller sidecar binary.
3. Builds signed NSIS and MSI bundles using secret `TAURI_SIGNING_PRIVATE_KEY`.
4. Computes SHA-256 package checksums (`SHA256SUMS.txt`).
5. Publishes a GitHub Release under tag `v1.1.0` with `latest.json` and all signed bundles attached.

---

## 5. Post-Release Verification

1. Verify download links at:
   `https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/tag/v1.1.0`
2. Verify updater endpoint returns HTTP 200 with valid JSON:
   `https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/latest/download/latest.json`
3. Launch an installed instance of CHECKPOINT v1.0.1, open **Settings $\rightarrow$ Updates & Release**, and verify the update indicator detects v1.1.0 cleanly.
