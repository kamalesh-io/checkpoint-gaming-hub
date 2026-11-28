import os
import sys
import subprocess
import hashlib
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent
    user_home = Path(os.environ.get("USERPROFILE", Path.home()))
    key_path = user_home / ".tauri" / "checkpoint_updater.key"

    print(f"[Release Build] Working directory: {root}")

    # 1. Verify sidecar binary exists
    sidecar = root / "src-tauri" / "binaries" / "checkpoint-backend-x86_64-pc-windows-msvc.exe"
    if not sidecar.exists():
        print(f"[Release Build] Sidecar missing! Building sidecar first...")
        res = subprocess.run([sys.executable, str(root / "backend" / "build_sidecar.py")], cwd=root)
        if res.returncode != 0:
            print("[Release Build] Failed to build sidecar binary!")
            sys.exit(1)
    else:
        print(f"[Release Build] Found sidecar binary: {sidecar} ({sidecar.stat().st_size:,} bytes)")

    # 2. Setup signing key environment variables
    env = os.environ.copy()
    if key_path.exists():
        print(f"[Release Build] Found Minisign private key at {key_path}")
        with open(key_path, "r", encoding="utf-8") as f:
            env["TAURI_SIGNING_PRIVATE_KEY"] = f.read().strip()
        env["TAURI_SIGNING_PRIVATE_KEY_PASSWORD"] = ""
    else:
        print(f"[Release Build] WARNING: Signing key not found at {key_path}. Build will be unsigned!")

    # 3. Build frontend
    print("[Release Build] Building production frontend...")
    frontend_dir = root / "frontend"
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    res = subprocess.run([npm_cmd, "run", "build"], cwd=frontend_dir)
    if res.returncode != 0:
        print("[Release Build] Frontend build failed!")
        sys.exit(1)

    # 4. Run Tauri Build
    print("[Release Build] Running Tauri build...")
    tauri_cli = frontend_dir / "node_modules" / "@tauri-apps" / "cli" / "tauri.js"
    res = subprocess.run(["node", str(tauri_cli), "build"], cwd=root, env=env)
    if res.returncode != 0:
        print("[Release Build] Tauri build failed!")
        sys.exit(1)

    # 5. Collect artifacts & compute SHA256
    bundle_dir = root / "src-tauri" / "target" / "release" / "bundle"
    dist_dir = root / "release_artifacts"
    dist_dir.mkdir(parents=True, exist_ok=True)

    artifacts = []
    for ext in ["*.exe", "*.msi", "*.sig", "*.zip", "latest.json"]:
        for file in bundle_dir.rglob(ext):
            if "nsis" in file.parts or "msi" in file.parts or file.name == "latest.json":
                dest = dist_dir / file.name
                dest.write_bytes(file.read_bytes())
                artifacts.append(dest)

    # Compute checksums
    checksum_lines = []
    for art in artifacts:
        if art.name.endswith(".txt"):
            continue
        h = hashlib.sha256(art.read_bytes()).hexdigest()
        checksum_lines.append(f"{h}  {art.name}")
        print(f"Artifact: {art.name} ({art.stat().st_size:,} bytes) - SHA256: {h[:16]}...")

    sums_file = dist_dir / "SHA256SUMS.txt"
    sums_file.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    print(f"[Release Build] Wrote {sums_file}")

    # Copy primary setup exe to root for convenience
    nsis_exe = dist_dir / "CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe"
    if nsis_exe.exists():
        root_exe = root / "CHECKPOINT_Setup_v1.1.0.exe"
        root_exe.write_bytes(nsis_exe.read_bytes())
        print(f"[Release Build] Created root setup shortcut: {root_exe}")

    print("[Release Build] Build and artifact packaging complete!")

if __name__ == "__main__":
    main()
