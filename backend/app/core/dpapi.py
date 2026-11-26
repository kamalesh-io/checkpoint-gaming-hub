"""Windows DPAPI encrypted credential storage with transparent plaintext migration."""
import base64
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

from app.core.logging import logger

_ENTROPY = b"CHECKPOINT_GAMING_HUB_DPAPI_V1"
_DPAPI_FORMAT = "dpapi-v1"
_CREDENTIAL_KEYS = (
    "igdb_client_id",
    "igdb_client_secret",
    "steamgriddb_api_key",
    "steam_web_api_key",
    "itad_api_key",
)


if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class _DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_byte)),
        ]

    _crypt32 = ctypes.windll.crypt32
    _kernel32 = ctypes.windll.kernel32
    _CRYPTPROTECT_UI_FORBIDDEN = 0x01

    def _bytes_to_blob(data: bytes) -> tuple[_DATA_BLOB, Any]:
        buf = (ctypes.c_byte * len(data)).from_buffer_copy(data)
        blob = _DATA_BLOB(len(data), buf)
        return blob, buf

    def dpapi_protect(plaintext: bytes) -> bytes:
        """Encrypts raw bytes using the current Windows user's DPAPI key."""
        if not plaintext:
            return b""
        in_blob, _in_buf = _bytes_to_blob(plaintext)
        ent_blob, _ent_buf = _bytes_to_blob(_ENTROPY)
        out_blob = _DATA_BLOB()

        ok = _crypt32.CryptProtectData(
            ctypes.byref(in_blob),
            "CHECKPOINT Credentials",
            ctypes.byref(ent_blob),
            None,
            None,
            _CRYPTPROTECT_UI_FORBIDDEN,
            ctypes.byref(out_blob),
        )
        if not ok:
            raise OSError(f"Windows DPAPI CryptProtectData failed (err={ctypes.GetLastError()})")

        try:
            return ctypes.string_at(out_blob.pbData, out_blob.cbData)
        finally:
            _kernel32.LocalFree(out_blob.pbData)

    def dpapi_unprotect(ciphertext: bytes) -> bytes:
        """Decrypts DPAPI-protected bytes back to plaintext for the current Windows user."""
        if not ciphertext:
            return b""
        in_blob, _in_buf = _bytes_to_blob(ciphertext)
        ent_blob, _ent_buf = _bytes_to_blob(_ENTROPY)
        out_blob = _DATA_BLOB()

        ok = _crypt32.CryptUnprotectData(
            ctypes.byref(in_blob),
            None,
            ctypes.byref(ent_blob),
            None,
            None,
            _CRYPTPROTECT_UI_FORBIDDEN,
            ctypes.byref(out_blob),
        )
        if not ok:
            raise OSError(f"Windows DPAPI CryptUnprotectData failed (err={ctypes.GetLastError()})")

        try:
            return ctypes.string_at(out_blob.pbData, out_blob.cbData)
        finally:
            _kernel32.LocalFree(out_blob.pbData)
else:
    def dpapi_protect(plaintext: bytes) -> bytes:
        raise RuntimeError("Windows DPAPI is only supported on Windows platforms.")

    def dpapi_unprotect(ciphertext: bytes) -> bytes:
        raise RuntimeError("Windows DPAPI is only supported on Windows platforms.")


def save_protected_credentials(path: Path, creds: Dict[str, Any]) -> None:
    """Encrypts credentials with Windows DPAPI and writes atomically to disk."""
    clean = {k: v for k, v in creds.items() if k in _CREDENTIAL_KEYS and v}
    raw_json = json.dumps(clean, separators=(",", ":")).encode("utf-8")
    protected_bytes = dpapi_protect(raw_json)
    envelope = {
        "version": 1,
        "format": _DPAPI_FORMAT,
        "payload": base64.b64encode(protected_bytes).decode("ascii"),
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(envelope, f, indent=2)
    os.replace(tmp_path, path)


def load_protected_credentials(path: Path) -> Dict[str, Any]:
    """Reads credentials from disk, transparently migrating legacy plaintext files to DPAPI."""
    if not path.exists() or not path.is_file():
        return {}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        logger.warning(f"Failed to read credentials store: {type(exc).__name__}")
        return {}

    if not isinstance(data, dict):
        return {}

    # Encrypted DPAPI envelope path
    if data.get("format") == _DPAPI_FORMAT and isinstance(data.get("payload"), str):
        try:
            cipher_bytes = base64.b64decode(data["payload"].encode("ascii"))
            plain_bytes = dpapi_unprotect(cipher_bytes)
            decoded = json.loads(plain_bytes.decode("utf-8"))
            return decoded if isinstance(decoded, dict) else {}
        except Exception as exc:
            logger.error(f"Failed to decrypt DPAPI credentials store: {type(exc).__name__}")
            return {}

    # Legacy plaintext JSON detected -> preserve values & migrate immediately to DPAPI
    legacy = {k: str(data[k]).strip() for k in _CREDENTIAL_KEYS if data.get(k)}
    if any(k in data for k in _CREDENTIAL_KEYS) or data == {}:
        try:
            save_protected_credentials(path, legacy)
            logger.info("Migrated legacy credentials.json to Windows DPAPI-protected storage.")
        except Exception as exc:
            logger.warning(f"Could not rewrite migrated DPAPI credentials: {type(exc).__name__}")
    return legacy
