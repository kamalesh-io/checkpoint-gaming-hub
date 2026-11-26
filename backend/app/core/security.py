"""Security utilities and authentication middleware for local API protection."""
import secrets
from typing import Optional
from fastapi import Header, HTTPException, Request, status
from app.core.config import settings
from app.core.logging import logger

HEADER_CHECKPOINT_TOKEN = "X-Checkpoint-Token"


def verify_checkpoint_token(x_checkpoint_token: Optional[str] = Header(None, alias=HEADER_CHECKPOINT_TOKEN)) -> str:
    """FastAPI dependency to enforce loopback authentication token."""
    # Skip token check only in explicit testing mode if configured
    if settings.APP_ENV == "testing" and not settings.CHECKPOINT_AUTH_TOKEN:
        return "test_token"

    expected_token = settings.get_auth_token_str()
    if not x_checkpoint_token or not secrets.compare_digest(x_checkpoint_token, expected_token):
        logger.warning("Rejected unauthorized request to local API.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Checkpoint-Token header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return x_checkpoint_token


async def security_handshake_middleware(request: Request, call_next):
    """Middleware enforcing loopback IP origin and token verification on protected routes."""
    client_host = request.client.host if request.client else "unknown"

    # Reject non-loopback connections immediately
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        logger.warning(f"Rejected connection from non-loopback host: {client_host}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Access restricted to local loopback interface.",
                }
            },
        )

    # Allow unauthenticated access to health check, docs, and openapi schema
    public_paths = (
        "/api/v1/system/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/artwork/cache/",
    )
    if any(request.url.path.startswith(path) for path in public_paths) or request.method == "OPTIONS":
        return await call_next(request)

    # In testing mode without explicit auth token, allow
    if settings.APP_ENV == "testing" and not settings.CHECKPOINT_AUTH_TOKEN:
        return await call_next(request)

    # Verify token
    token = request.headers.get(HEADER_CHECKPOINT_TOKEN)
    expected_token = settings.get_auth_token_str()
    if not token or not secrets.compare_digest(token, expected_token):
        logger.warning(f"Unauthorized request to {request.url.path}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or missing X-Checkpoint-Token header.",
                }
            },
        )

    return await call_next(request)
