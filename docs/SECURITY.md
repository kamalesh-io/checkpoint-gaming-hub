# CHECKPOINT Gaming Hub — Security & Credential Management Specification

**Document Version:** 1.0.0  
**Status:** Approved Security Architecture  
**Scope:** Local Host Boundary, API Credentials, Data Protection, Network Safety  

---

## 1. Threat Model & Security Posture

As a local-first desktop application operating on Windows, CHECKPOINT interacts with external APIs (IGDB, SteamGridDB), operates a local Python REST service, and renders UI via Tauri's WebView2. The security model addresses four primary attack surfaces:

1. **Local Inter-Process Snooping**: Preventing other local non-privileged applications, browser tabs, or scripts running on the user's PC from interrogating or altering the local CHECKPOINT database.
2. **Credential Exposure**: Protecting Twitch/IGDB and SteamGridDB API secrets from being leaked, printed to logs, exposed via error traces, or committed to version control.
3. **Data Injection & XSS**: Preventing malicious metadata, game titles, or user journal entries from injecting malicious script payloads into the desktop webview.
4. **Path Traversal & Storage Injection**: Preventing malicious image URLs or crafted backup files from overwriting files outside the designated Windows AppData directory.

---

## 2. Local Backend Protection Architecture

### 2.1 Loopback Interface Binding
The FastAPI backend service is strictly bound to the loopback interface (`127.0.0.1`):
* It never binds to `0.0.0.0` or public network adapters.
* Any external network connection attempting to reach port 8765 is rejected at the Windows socket layer.

### 2.2 Ephemeral Shared Secret Handshake
To ensure that only the verified Tauri desktop shell can communicate with the FastAPI backend:

```
[Tauri Rust Host Shell]
           |
           +-- 1. Generates 256-bit cryptographically secure random token (UUIDv4) in memory.
           |
           +-- 2. Spawns Python sidecar: `checkpoint-backend.exe --token <SECRET>`
           |
           +-- 3. Injects token into WebView2 secure sessionStorage/context.
           |
           v
[Frontend API Client] ---> HTTP Header: `X-Checkpoint-Token: <SECRET>` ---> [FastAPI Middleware]
                                                                                   |
                                                              +-- Verified? OK (200)
                                                              +-- Invalid? Reject (401 Unauthorized)
```

1. **Token Generation**: Generated at application startup in Rust memory (128-bit cryptographic hex via `rand`). It is never written to disk or configuration files.
2. **Cryptographic Readiness Verification**: Rust readiness probes query the authenticated `/api/v1/system/status` route with a per-probe random `X-Checkpoint-Nonce` header and verify the returned `X-Checkpoint-Proof` equals `HMAC-SHA256(token, nonce)` alongside child liveness (`try_wait`) and Windows Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`) containment.
3. **Middleware Verification**: A custom FastAPI middleware intercepts every request (except `/system/health`, OpenAPI schema, and cached artwork reads). If `X-Checkpoint-Token` does not match the active session token, the request immediately terminates with `401 Unauthorized`.
4. **Strict CORS Whitelist**: Only origins originating from Tauri (`tauri://localhost` and `http://localhost:5173` in development) are accepted.

---

## 3. Credential & Secret Management

### 3.1 Existing Backend `.env` Safety
* The repository's `backend/.env` holds live IGDB and SteamGridDB development keys.
* **Preservation Policy**:
  * Never print, log, echo, or inspect `.env` contents.
  * `.gitignore` explicitly prevents `.env` and `*.env` files from ever entering git commits.
  * `backend/.env.example` is maintained with placeholder keys for public code sharing.

### 3.2 In-Memory Configuration via Pydantic
Secrets are loaded strictly at startup into memory via `pydantic-settings`:

```python
class Settings(BaseSettings):
    TWITCH_CLIENT_ID: SecretStr
    TWITCH_CLIENT_SECRET: SecretStr
    STEAMGRIDDB_API_KEY: SecretStr
    CHECKPOINT_AUTH_TOKEN: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```
* Using `SecretStr` guarantees that calling `str(settings)` or printing settings in error logs automatically outputs `**********` instead of the raw credential.

### 3.3 DPAPI Encrypted Runtime Credentials Storage
* Production API credentials entered in Settings are encrypted via **Windows DPAPI** (`crypt32.CryptProtectData` / `CryptUnprotectData` with application entropy) in `backend/app/core/dpapi.py` and stored atomically in `%APPDATA%/Checkpoint/credentials.json` (`"format": "dpapi-v1"`).
* Legacy plaintext `credentials.json` files are transparently migrated to DPAPI encryption on first load while preserving all configured credentials cleanly.

---

## 4. External API Integration & Rate Limiting

### 4.1 IGDB v4 & Twitch OAuth Pipeline
* **Token Caching**: The backend acquires a Twitch OAuth Bearer token using client credentials. The token is cached in memory with its expiration timestamp. New tokens are only requested when the active token has less than 24 hours of remaining validity.
* **Rate Limiting**: IGDB enforces a strict ceiling of **4 requests per second**. The backend wraps the async HTTPX client in an `asyncio.Semaphore(4)` and a sliding-window rate limiter to guarantee compliance and avoid HTTP 429 throttling.

### 4.2 SteamGridDB Asset Safety
* **Rate Limiting**: Throttled with exponential backoff and randomized jitter upon receiving an HTTP 429 status code.
* **URL Validation**: Download requests only permit verified HTTPS endpoints originating from trusted CDN domains (`images.igdb.com`, `cdn2.steamgriddb.com`).

---

## 5. Storage Security & Path Sanitization

### 5.1 Safe Path Resolution
To prevent directory traversal attacks (e.g., `../../Windows/System32`):
```python
def resolve_safe_cache_path(filename: str, subfolder: str) -> Path:
    # Enforce strict alphanumeric + hash naming
    sanitized_name = re.sub(r'[^a-zA-Z0-9_\.-]', '', filename)
    base_dir = Path(settings.APP_DATA_DIR) / "artwork_cache" / subfolder
    target_path = (base_dir / sanitized_name).resolve()
    
    # Verify the target path resides strictly within the designated AppData directory
    if not target_path.is_relative_to(base_dir):
        raise SecurityException("Path traversal attempt detected.")
    return target_path
```

### 5.2 Image Magic Byte Verification
Before writing any downloaded artwork file to the local disk cache:
* The first 16 bytes of the payload are verified for valid image magic signatures:
  * **JPEG**: `\xFF\xD8\xFF`
  * **PNG**: `\x89\x50\x4E\x47\x0D\x0A\x1A\x0A`
  * **WebP**: `RIFF....WEBP`
* Discrepant payloads (e.g., HTML error pages, executable binaries) are discarded immediately without saving.

---

## 6. Content Sanitization & XSS Prevention

* **DOMPurify Integration**: Any rich text or user notes rendered in the Gaming Journal are sanitized using DOMPurify before DOM injection.
* **External Metadata Escaping**: All titles, descriptions, and developer strings imported from IGDB are treated as untrusted strings and rendered via standard React text interpolation (preventing `dangerouslySetInnerHTML`).
