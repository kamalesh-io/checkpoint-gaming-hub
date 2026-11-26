"""Secure, redacted logging configuration for CHECKPOINT."""
import logging
import re
import sys
from typing import List

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


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configures application logger with redaction."""
    logger = logging.getLogger("checkpoint")
    logger.setLevel(level.upper())

    # Avoid duplicate handlers on reload
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = RedactingFormatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.propagate = False

    return logger


logger = setup_logging()
