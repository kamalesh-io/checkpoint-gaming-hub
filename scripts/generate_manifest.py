import json
import datetime
from pathlib import Path

def generate_manifest():
    root = Path(__file__).resolve().parent.parent
    dist_dir = root / "release_artifacts"
    sig_file = dist_dir / "CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe.sig"
    
    if not sig_file.exists():
        # Fallback to bundle location
        sig_file = root / "src-tauri" / "target" / "release" / "bundle" / "nsis" / "CHECKPOINT Gaming Hub_1.1.0_x64-setup.exe.sig"
    
    signature = sig_file.read_text(encoding="utf-8").strip()
    
    manifest = {
        "version": "1.1.0",
        "notes": "CHECKPOINT Gaming Hub v1.1.0 — Cinematic UI V3, Procedural Web Audio Sound System & Signed Automatic Updates",
        "pub_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platforms": {
            "windows-x86_64": {
                "signature": signature,
                "url": "https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/download/v1.1.0/CHECKPOINT.Gaming.Hub_1.1.0_x64-setup.exe"
            }
        }
    }
    
    # Also write with encoded URL variant
    manifest_alt = dict(manifest)
    manifest_alt["platforms"] = {
        "windows-x86_64": {
            "signature": signature,
            "url": "https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/download/v1.1.0/CHECKPOINT_Gaming_Hub_1.1.0_x64-setup.exe"
        }
    }
    
    out_path = dist_dir / "latest.json"
    out_path.write_text(json.dumps(manifest_alt, indent=2), encoding="utf-8")
    
    # Also write to root for convenient release staging
    (root / "latest.json").write_text(json.dumps(manifest_alt, indent=2), encoding="utf-8")
    print(f"Generated updater manifest at {out_path} and {root / 'latest.json'}")

if __name__ == "__main__":
    generate_manifest()
