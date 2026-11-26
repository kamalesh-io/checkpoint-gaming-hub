"""Reproducible build script for CHECKPOINT Python backend sidecar."""
import os
import shutil
import subprocess
import sys
from pathlib import Path

def main():
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent
    dist_dir = backend_dir / "dist"
    build_dir = backend_dir / "build"
    spec_file = backend_dir / "checkpoint-backend.spec"
    target_bin_dir = repo_root / "src-tauri" / "binaries"

    target_bin_dir.mkdir(parents=True, exist_ok=True)
    target_exe_name = "checkpoint-backend-x86_64-pc-windows-msvc.exe"
    target_exe_path = target_bin_dir / target_exe_name

    print(f"Building CHECKPOINT standalone sidecar binary using PyInstaller...")
    print(f"Spec file: {spec_file}")

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        str(spec_file),
    ]

    result = subprocess.run(cmd, cwd=str(backend_dir))
    if result.returncode != 0:
        print(f"Error: PyInstaller build failed with exit code {result.returncode}", file=sys.stderr)
        sys.exit(result.returncode)

    built_exe = dist_dir / target_exe_name
    if not built_exe.exists():
        print(f"Error: Expected build output {built_exe} not found!", file=sys.stderr)
        sys.exit(1)

    print(f"Copying {built_exe} to {target_exe_path}...")
    shutil.copy2(built_exe, target_exe_path)

    size_mb = target_exe_path.stat().st_size / (1024 * 1024)
    print(f"Successfully packaged {target_exe_name} ({size_mb:.2f} MB)")
    print(f"Destination: {target_exe_path}")

if __name__ == "__main__":
    main()
