# Security Policy

## Supported Versions

CHECKPOINT Gaming Hub provides security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Local-First Security Architecture

CHECKPOINT operates on a local-first privacy model:
1. **Loopback Only**: The internal FastAPI backend binds strictly to `127.0.0.1` and is never exposed to external network interfaces.
2. **Ephemeral Handshake Token**: Frontend and backend communicate via an authenticated `X-Checkpoint-Token` handshake generated dynamically at application launch.
3. **DPAPI Credential Protection**: API keys (IGDB, SteamGridDB, Steam Web API, IsThereAnyDeal) entered in Settings are encrypted locally using Windows Data Protection API (DPAPI) and stored in `%APPDATA%\Checkpoint\credentials.json`.
4. **Shell Injection Prevention**: All executable launch paths are strictly verified to ensure valid `.exe` files and reject shell metacharacters (`&`, `|`, `;`, `>`, `<`, `` ` ``, `$`).

---

## Reporting a Vulnerability

If you discover a security vulnerability or potential credential exposure in CHECKPOINT Gaming Hub, please report it responsibly:

* **Do NOT** open a public issue on GitHub.
* Please submit a private advisory through GitHub Security Advisories:
  https://github.com/kamalesh-io/checkpoint-gaming-hub/security/advisories/new
* Alternatively, contact the repository maintainer directly via GitHub profile message.

### What to Include:
* Type of issue (e.g. buffer overflow, credential exposure, path traversal, IPC bypass).
* Step-by-step instructions or proof-of-concept to reproduce the issue.
* Any potential impact or suggested mitigations.

We will acknowledge receipt within 48 hours and work with you to verify and patch the vulnerability promptly.
