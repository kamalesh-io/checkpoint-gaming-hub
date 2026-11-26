"""System health, integration probes, and statistics endpoints."""
import hashlib
import hmac
import time
from typing import Optional
from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.database.session import get_db
from app.repositories.library_repo import LibraryRepository
from app.schemas.system import (
    CredentialsUpdateRequest,
    HealthResponse,
    IntegrationStatus,
    ShutdownResponse,
    SystemStatsResponse,
)
from app.services.twitch_auth import twitch_auth_manager

router = APIRouter(prefix="/system", tags=["System"])
_boot_time = time.time()
_shutdown_trigger = None


def register_shutdown_trigger(fn):
    """Registers a callback invoked when /system/shutdown is called."""
    global _shutdown_trigger
    _shutdown_trigger = fn


@router.get("/health", response_model=HealthResponse)
async def get_health(db: AsyncSession = Depends(get_db)):
    """Health probe queried by Tauri and monitors."""
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.APP_VERSION,
        database=db_status,
        storage_dir=str(settings.DATA_DIR),
        uptime_seconds=round(time.time() - _boot_time, 2),
    )


@router.get("/status", response_model=HealthResponse)
async def get_status(
    response: Response,
    db: AsyncSession = Depends(get_db),
    x_checkpoint_nonce: Optional[str] = Header(None, alias="X-Checkpoint-Nonce"),
):
    """Authenticated readiness & status probe with cryptographic HMAC handshake proof."""
    if x_checkpoint_nonce:
        token = settings.get_auth_token_str()
        proof = hmac.new(
            token.encode("utf-8"),
            x_checkpoint_nonce.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        response.headers["X-Checkpoint-Proof"] = proof
    return await get_health(db)


@router.get("/integrations", response_model=IntegrationStatus)
async def get_integration_status():
    """Reports status of external API keys without exposing secrets."""
    igdb_ready = bool(
        settings.IGDB_CLIENT_ID
        and settings.IGDB_CLIENT_SECRET
        and settings.IGDB_CLIENT_ID.get_secret_value()
        and settings.IGDB_CLIENT_SECRET.get_secret_value()
    )
    steamgriddb_ready = bool(
        settings.STEAMGRIDDB_API_KEY and settings.STEAMGRIDDB_API_KEY.get_secret_value()
    )

    return IntegrationStatus(
        igdb_connected=igdb_ready,
        steamgriddb_connected=steamgriddb_ready,
        twitch_token_active=twitch_auth_manager.is_token_valid,
        details={
            "igdb": "Credentials configured" if igdb_ready else "Missing credentials",
            "steamgriddb": "API Key configured" if steamgriddb_ready else "Missing API key",
        },
    )


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """Computes aggregated dashboard and profile statistics."""
    repo = LibraryRepository(db)
    stats = await repo.get_system_stats()
    return SystemStatsResponse(**stats)


@router.post("/credentials", response_model=IntegrationStatus)
async def update_production_credentials(req: CredentialsUpdateRequest):
    """Updates and securely persists production API credentials to %APPDATA%/Checkpoint/credentials.json."""
    settings.update_credentials(
        igdb_id=req.igdb_client_id,
        igdb_secret=req.igdb_client_secret,
        sgdb_key=req.steamgriddb_api_key,
    )
    # Invalidate existing twitch token cache so fresh token is fetched with new credentials
    twitch_auth_manager.invalidate_token()
    return await get_integration_status()


@router.post("/shutdown", response_model=ShutdownResponse)
async def shutdown_system():
    """Triggers graceful shutdown of the local sidecar server."""
    if _shutdown_trigger:
        import asyncio
        asyncio.get_running_loop().call_soon(_shutdown_trigger)
    return ShutdownResponse(status="shutting_down")
