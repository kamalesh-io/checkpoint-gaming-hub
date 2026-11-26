# Contributing to CHECKPOINT Gaming Hub

Thank you for your interest in contributing to **CHECKPOINT Gaming Hub**! We welcome contributions to make CHECKPOINT the premier local-first personal gaming management hub for Windows.

---

## Code of Conduct

Please be respectful and constructive in all discussions, pull requests, and issue reports. We aim to foster a collaborative and welcoming community.

---

## Development Setup

### Prerequisites
* **Windows 10 / 11 (64-bit)**
* **Node.js**: v20.x or later + `npm`
* **Python**: v3.11+ (Python 3.12 recommended)
* **Rust**: v1.75+ with the MSVC toolchain (`x86_64-pc-windows-msvc`)
* **Visual Studio 2022 C++ Build Tools** (for Tauri desktop builds)

### 1. Clone the Repository
```bash
git clone https://github.com/kamalesh-io/checkpoint-gaming-hub.git
cd checkpoint-gaming-hub
```

### 2. Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your dev credentials
alembic upgrade head
uvicorn app.main:app --port 8765 --reload
```

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

### 4. Running Full Desktop App (Tauri)
```powershell
# From repository root
cargo tauri dev
```

---

## Code Conventions & Standards

* **Frontend**:
  * React 18/19 with TypeScript strict mode.
  * Tailwind CSS for styling with CHECKPOINT V2 tokens.
  * Always provide `[data-nav-item="true"]` for interactive elements to ensure 10-foot controller accessibility.
* **Backend**:
  * Python 3.11+ using FastAPI and SQLAlchemy 2.0 async.
  * Pydantic v2 schemas for request/response serialization.
  * Write-Ahead Logging (`WAL`) mode for SQLite databases.
* **Desktop Shell (Rust)**:
  * Tauri 2.0 with minimal unsafe code.
  * Secure inter-process communication (IPC) validating all parameters.

---

## Testing Requirements

Before opening a pull request, ensure all verification suites pass:

```powershell
# 1. Backend tests
cd backend
pytest

# 2. Frontend checks
cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run build

# 3. Rust shell tests
cd ..
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## Commit Guidelines

We use conventional commit messages:
* `feat: add Steam Family sharing tag filter`
* `fix: prevent focus loss when dismissing virtual keyboard`
* `docs: update user guide with price tracking steps`
* `test: add unit test for deadzone calculation`

---

## Submitting a Pull Request

1. Fork the repository and create your feature branch: `git checkout -b feat/my-new-feature`.
2. Commit your changes following the guidelines above.
3. Push to your fork: `git push origin feat/my-new-feature`.
4. Submit a Pull Request targeting the `main` branch.
5. Ensure the CI workflow passes on your pull request.
