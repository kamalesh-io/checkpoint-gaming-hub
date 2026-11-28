"""Secure, redacted logging configuration for CHECKPOINT."""
import collections
import datetime
import logging
import os
from pathlib import Path
import re
import sys
import threading
from typing import Any, Dict, List, Optional

SENSITIVE_PATTERNS: List[re.Pattern] = [
    re.compile(r'(token["\s:=]+)([A-Za-z0-9_\-\.]{8,})', re.IGNORECASE),
    re.compile(r'(secret["\s:=]+)([A-Za-z0-9_\-\.]{8,})', re.IGNORECASE),
    re.compile(r'(api[_\-]?key["\s:=]+)([A-Za-z0-9_\-\.]{8,})', re.IGNORECASE),
    re.compile(r'(authorization:\s*Bearer\s+)([A-Za-z0-9_\-\.]{8,})', re.IGNORECASE),
]


class RedactingFormatter(logging.Formatter):
    """Custom formatter that redacts detected secrets and credentials."""

    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        redacted = original
        for pattern in SENSITIVE_PATTERNS:
            redacted = pattern.sub(r"\1[REDACTED]", redacted)
        return redacted


class MemoryLogBuffer:
    """Thread-safe circular in-memory buffer storing recent log entries."""

    def __init__(self, maxlen: int = 2500):
        self._buffer: collections.deque = collections.deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def append(self, entry: Dict[str, Any]):
        with self._lock:
            self._buffer.append(entry)

    def get_logs(
        self,
        level: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            items = list(self._buffer)

        if level and level.upper() != "ALL":
            target_level = level.upper()
            items = [item for item in items if item.get("level") == target_level]

        if search:
            q = search.lower()
            items = [
                item for item in items
                if q in item.get("message", "").lower()
                or q in item.get("logger", "").lower()
                or q in item.get("location", "").lower()
            ]

        # Return latest entries up to limit
        return items[-limit:]

    def clear(self):
        with self._lock:
            self._buffer.clear()

    @property
    def total_count(self) -> int:
        with self._lock:
            return len(self._buffer)


log_buffer = MemoryLogBuffer(maxlen=2500)


class MemoryLogHandler(logging.Handler):
    """Logging handler that appends redacted log entries to memory buffer."""

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            entry = {
                "timestamp": datetime.datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                "level": record.levelname,
                "logger": record.name,
                "location": f"{record.filename}:{record.lineno}",
                "message": msg,
            }
            log_buffer.append(entry)
        except Exception:
            self.handleError(record)


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configures application logger with redaction, stream output, and memory buffer."""
    logger = logging.getLogger("checkpoint")
    logger.setLevel(level.upper())

    # Avoid duplicate handlers on reload
    if not logger.handlers:
        formatter = RedactingFormatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        # 1. Console Stream Handler
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        # 2. In-Memory Ring Buffer Handler
        mem_handler = MemoryLogHandler()
        mem_handler.setFormatter(formatter)
        logger.addHandler(mem_handler)

        # 3. Rotating File Handler under %APPDATA%/Checkpoint/logs
        try:
            appdata = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
            if appdata:
                log_dir = Path(appdata) / "Checkpoint" / "logs"
                log_dir.mkdir(parents=True, exist_ok=True)
                from logging.handlers import RotatingFileHandler
                file_handler = RotatingFileHandler(
                    log_dir / "checkpoint.log",
                    maxBytes=5 * 1024 * 1024,
                    backupCount=3,
                    encoding="utf-8",
                )
                file_handler.setFormatter(formatter)
                logger.addHandler(file_handler)
        except Exception:
            pass

        logger.propagate = False

    return logger


logger = setup_logging()
