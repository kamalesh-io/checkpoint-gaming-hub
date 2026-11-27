"""CHECKPOINT Gaming Hub - FastAPI Application Main Entry Point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import CheckpointException
from app.core.logging import logger
from app.core.security import security_handshake_middleware
from app.database.engine import dispose_engine, init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager: sets up directories, database, and performs clean shutdown."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} ({settings.APP_ENV} mode)...")
    
    # Ensure all local storage directories exist
    settings.ensure_directories()
    
    # Initialize database tables if not already present
    await init_db()
    logger.info("Database connection and schema verified.")
    
    yield
    
    # Cleanup resources on shutdown
    logger.info("Shutting down CHECKPOINT application...")
    await dispose_engine()
    logger.info("Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Local-first Windows Gaming Hub backend API for game management, metadata retrieval, and artwork caching.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS middleware for local Tauri desktop webview and local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?|tauri://localhost)$",
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8765",
        "http://127.0.0.1:8765",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Loopback and X-Checkpoint-Token security handshake middleware
app.middleware("http")(security_handshake_middleware)

def _cors_response(request: Request, response: JSONResponse) -> JSONResponse:
    """Attaches CORS headers to direct JSON responses to prevent browser fetch failures."""
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# Register custom exception handlers
@app.exception_handler(CheckpointException)
async def checkpoint_exception_handler(request: Request, exc: CheckpointException):
    """Handle domain exceptions with structured error response."""
    logger.warning(f"Domain exception on {request.url.path}: [{exc.code}] {exc.message}")
    return _cors_response(
        request,
        JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request schema validation errors."""
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    return _cors_response(
        request,
        JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request parameters or payload.",
                    "details": {"errors": exc.errors()},
                }
            },
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle standard HTTP exceptions with unified error envelope."""
    return _cors_response(
        request,
        JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                }
            },
            headers=getattr(exc, "headers", None),
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all unhandled exception handler to avoid leaking raw tracebacks."""
    logger.exception(f"Unhandled server error on {request.url.path}: {str(exc)}")
    return _cors_response(
        request,
        JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal server error occurred.",
                }
            },
        ),
    )


# Include API v1 router
app.include_router(api_router)


@app.get("/", tags=["system"])
async def root():
    """Root metadata discovery endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "status": "online",
        "docs_url": "/docs",
        "api_v1_prefix": "/api/v1",
    }
