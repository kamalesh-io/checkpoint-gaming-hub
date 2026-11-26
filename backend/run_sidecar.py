"""CHECKPOINT Gaming Hub - Packaged Backend Sidecar Entry Point.

Runs the local FastAPI backend on loopback (127.0.0.1) with dynamic port detection,
Alembic migration auto-execution, private process secret configuration,
and clean stdin-EOF shutdown.
"""

import asyncio
import os
import socket
import sys
import threading
from pathlib import Path

# Ensure application package is on sys.path
BASE_DIR = Path(__file__).resolve().parent
if getattr(sys, "frozen", False):
    # PyInstaller temporary extraction folder
    BASE_DIR = Path(getattr(sys, "_MEIPASS", BASE_DIR))

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from alembic import command
from alembic.config import Config
import uvicorn

from app.core.config import settings
from app.core.logging import logger
from app.main import app


def run_alembic_migrations():
    """Runs pending Alembic database migrations up to head."""
    try:
        ini_path = BASE_DIR / "alembic.ini"
        if not ini_path.exists():
            ini_path = Path(__file__).resolve().parent / "alembic.ini"

        script_loc = BASE_DIR / "alembic"
        if not script_loc.exists():
            script_loc = Path(__file__).resolve().parent / "alembic"

        if ini_path.exists() and script_loc.exists():
            logger.info(f"Applying database migrations from {script_loc}...")
            cfg = Config(str(ini_path))
            cfg.set_main_option("script_location", str(script_loc))
            db_url = settings.get_database_url().replace("sqlite+aiosqlite:///", "sqlite:///")
            cfg.set_main_option("sqlalchemy.url", db_url)
            command.upgrade(cfg, "head")
            logger.info("Database migrations verified and applied.")
        else:
            logger.warning("Alembic configuration not found; relying on init_db() table creation.")
    except Exception as exc:
        import traceback
        print(f"Error executing database migrations: {exc}", file=sys.stderr)
        traceback.print_exc()


def monitor_stdin_for_exit(server: uvicorn.Server):
    """Watches stdin for EOF to ensure process terminates if parent exits."""
    try:
        sys.stdin.read()
    except Exception:
        pass
    logger.info("Parent process pipe closed. Initiating graceful sidecar shutdown...")
    server.should_exit = True


def bind_loopback_socket(preferred_port: int) -> socket.socket:
    """Bind loopback TCP socket on preferred port or fallback ephemeral port without race conditions."""
    candidates = [preferred_port, 0] if preferred_port != 0 else [0]
    for candidate_port in candidates:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            sock.bind(("127.0.0.1", candidate_port))
            sock.listen(2048)
            sock.setblocking(False)
            return sock
        except OSError as exc:
            sock.close()
            if candidate_port != 0:
                logger.warning(
                    f"Preferred port {candidate_port} unavailable ({exc}). "
                    "Binding dynamic ephemeral port..."
                )
            else:
                raise
    raise RuntimeError("Failed to bind loopback socket")


async def main():
    # 1. Determine requested port (default 8765, or CHECKPOINT_PORT env)
    port_env = os.getenv("CHECKPOINT_PORT", "8765")
    try:
        preferred_port = int(port_env)
    except ValueError:
        preferred_port = 8765

    # 2. Bind OS loopback socket directly to prevent TOCTOU port race conditions
    sock = bind_loopback_socket(preferred_port)
    actual_port = sock.getsockname()[1]

    cfg = uvicorn.Config(app=app, host="127.0.0.1", port=actual_port, log_level="info")

    # 3. Announce bound port and readiness protocol to parent process
    print(f"CHECKPOINT_BOUND_PORT={actual_port}", flush=True)
    print(f"CHECKPOINT_READY={actual_port}", flush=True)

    server = uvicorn.Server(cfg)

    # Register shutdown hook for /api/v1/system/shutdown endpoint
    from app.api.v1.system import register_shutdown_trigger
    register_shutdown_trigger(lambda: setattr(server, "should_exit", True))

    # 5. Spawn stdin monitor thread for bulletproof parent-death detection
    stdin_thread = threading.Thread(target=monitor_stdin_for_exit, args=(server,), daemon=True)
    stdin_thread.start()

    # 6. Run server using pre-bound socket
    logger.info(f"CHECKPOINT sidecar listening on 127.0.0.1:{actual_port}")
    await server.serve(sockets=[sock])
    logger.info("CHECKPOINT sidecar exited cleanly.")


if __name__ == "__main__":
    try:
        settings.ensure_directories()
        run_alembic_migrations()
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
