"""System health, integration probes, and statistics endpoints."""
import hashlib
import hmac
import time
from typing import Optional
from fastapi import APIRouter, Depends, Header, Response
import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.database.session import get_db
from app.models.steam import SteamAccount
from app.repositories.library_repo import LibraryRepository
from app.schemas.system import (
    CredentialsUpdateRequest,
    HealthResponse,
    IntegrationStatus,
    ShutdownResponse,
    SystemStatsResponse,
    TestServiceConnectionRequest,
    TestServiceConnectionResponse,
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
async def get_integration_status(db: AsyncSession = Depends(get_db)):
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
    itad_ready = bool(settings.get_itad_api_key())

    steam_account_res = await db.execute(select(SteamAccount).where(SteamAccount.is_connected == True))  # noqa: E712
    steam_account = steam_account_res.scalar_one_or_none()
    steam_ready = steam_account is not None

    details = {
        "igdb": "Active Twitch Token (Connected)" if twitch_auth_manager.is_token_valid else ("Credentials configured" if igdb_ready else "Missing credentials"),
        "steamgriddb": "API Key configured" if steamgriddb_ready else "Missing API key",
        "steam": f"Connected to {steam_account.persona_name or steam_account.steam_id_64}" if steam_ready and steam_account else "Not Connected",
        "itad": "API Key configured (INR regional deals enabled)" if itad_ready else "Missing API key",
    }

    return IntegrationStatus(
        igdb_connected=igdb_ready,
        steamgriddb_connected=steamgriddb_ready,
        twitch_token_active=twitch_auth_manager.is_token_valid,
        steam_connected=steam_ready,
        itad_connected=itad_ready,
        details=details,
    )


@router.post("/test-service", response_model=TestServiceConnectionResponse)
async def test_service_connection(
    req: TestServiceConnectionRequest, db: AsyncSession = Depends(get_db)
):
    """Tests connection to an external API (igdb, steamgriddb, itad, steam) without saving credentials."""
    t0 = time.time()
    service = req.service.lower()

    if service == "igdb":
        client_id = req.client_id or (settings.IGDB_CLIENT_ID.get_secret_value() if settings.IGDB_CLIENT_ID else None)
        client_secret = req.client_secret or (settings.IGDB_CLIENT_SECRET.get_secret_value() if settings.IGDB_CLIENT_SECRET else None)
        if not client_id or not client_secret:
            return TestServiceConnectionResponse(
                service="igdb",
                status="not_configured",
                message="Client ID and Client Secret are required.",
            )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                token_res = await client.post(
                    "https://id.twitch.tv/oauth2/token",
                    params={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "grant_type": "client_credentials",
                    },
                )
                if token_res.status_code != 200:
                    return TestServiceConnectionResponse(
                        service="igdb",
                        status="authentication_failed",
                        message="Invalid Twitch Client ID or Client Secret.",
                        latency_ms=int((time.time() - t0) * 1000),
                    )
                token_data = token_res.json()
                access_token = token_data.get("access_token")
                igdb_res = await client.post(
                    "https://api.igdb.com/v4/games",
                    headers={"Client-ID": client_id, "Authorization": f"Bearer {access_token}"},
                    content="fields id; limit 1;",
                )
                if igdb_res.status_code == 200:
                    return TestServiceConnectionResponse(
                        service="igdb",
                        status="connected",
                        message="IGDB / Twitch API verified successfully.",
                        latency_ms=int((time.time() - t0) * 1000),
                    )
                return TestServiceConnectionResponse(
                    service="igdb",
                    status="authentication_failed",
                    message=f"IGDB query returned HTTP {igdb_res.status_code}.",
                    latency_ms=int((time.time() - t0) * 1000),
                )
        except httpx.TimeoutException:
            return TestServiceConnectionResponse(
                service="igdb",
                status="unreachable",
                message="Connection to Twitch / IGDB timed out.",
                latency_ms=int((time.time() - t0) * 1000),
            )
        except Exception as exc:
            return TestServiceConnectionResponse(
                service="igdb",
                status="unreachable",
                message=f"Network error reaching IGDB: {type(exc).__name__}",
                latency_ms=int((time.time() - t0) * 1000),
            )

    elif service == "steamgriddb":
        api_key = req.api_key or (settings.STEAMGRIDDB_API_KEY.get_secret_value() if settings.STEAMGRIDDB_API_KEY else None)
        if not api_key:
            return TestServiceConnectionResponse(
                service="steamgriddb",
                status="not_configured",
                message="SteamGridDB API key is required.",
            )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    "https://www.steamgriddb.com/api/v2/games/search",
                    params={"term": "Cyberpunk"},
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if res.status_code == 200:
                    return TestServiceConnectionResponse(
                        service="steamgriddb",
                        status="connected",
                        message="SteamGridDB API key verified successfully.",
                        latency_ms=int((time.time() - t0) * 1000),
                    )
                if res.status_code in (401, 403):
                    return TestServiceConnectionResponse(
                        service="steamgriddb",
                        status="authentication_failed",
                        message="Invalid SteamGridDB API key.",
                        latency_ms=int((time.time() - t0) * 1000),
                    )
                return TestServiceConnectionResponse(
                    service="steamgriddb",
                    status="unreachable",
                    message=f"SteamGridDB returned HTTP {res.status_code}.",
                    latency_ms=int((time.time() - t0) * 1000),
                )
        except Exception as exc:
            return TestServiceConnectionResponse(
                service="steamgriddb",
                status="unreachable",
                message=f"Network error reaching SteamGridDB: {type(exc).__name__}",
                latency_ms=int((time.time() - t0) * 1000),
            )

    elif service == "itad":
        api_key = req.api_key or settings.get_itad_api_key()
        if not api_key:
            return TestServiceConnectionResponse(
                service="itad",
                status="not_configured",
                message="IsThereAnyDeal API key is required.",
            )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    "https://api.isthereanydeal.com/games/lookup/v1",
                    params={"key": api_key, "title": "Portal"},
                )
                if res.status_code == 200:
                    return TestServiceConnectionResponse(
                        service="itad",
                        status="connected",
                        message="IsThereAnyDeal API key verified successfully (INR regional deals enabled).",
                        latency_ms=int((time.time() - t0) * 1000),
                    )
                if res.status_code in (401, 403):
                    return TestServiceConnectionResponse(
                        service="itad",
                        status="authentication_failed",
                        message="Invalid IsThereAnyDeal API key.",
                        latency_ms=int((time.time() - t0) * 1000),
                    )
                return TestServiceConnectionResponse(
                    service="itad",
                    status="unreachable",
                    message=f"IsThereAnyDeal returned HTTP {res.status_code}.",
                    latency_ms=int((time.time() - t0) * 1000),
                )
        except Exception as exc:
            return TestServiceConnectionResponse(
                service="itad",
                status="unreachable",
                message=f"Network error reaching IsThereAnyDeal: {type(exc).__name__}",
                latency_ms=int((time.time() - t0) * 1000),
            )

    elif service == "steam":
        from app.services.steam import SteamService
        steam_service = SteamService(db)
        steam_id = req.steam_id_64 or ""
        res = await steam_service.test_connection(steam_id, req.api_key)
        return TestServiceConnectionResponse(
            service="steam",
            status="connected" if res.success else "authentication_failed",
            message=res.message,
            latency_ms=int((time.time() - t0) * 1000),
        )

    return TestServiceConnectionResponse(
        service=service,
        status="not_configured",
        message=f"Unknown service: {service}",
    )


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """Computes aggregated dashboard and profile statistics."""
    repo = LibraryRepository(db)
    stats = await repo.get_system_stats()
    return SystemStatsResponse(**stats)


@router.post("/credentials", response_model=IntegrationStatus)
async def update_production_credentials(
    req: CredentialsUpdateRequest, db: AsyncSession = Depends(get_db)
):
    """Updates and securely persists production API credentials to %APPDATA%/Checkpoint/credentials.json."""
    settings.update_credentials(
        igdb_id=req.igdb_client_id,
        igdb_secret=req.igdb_client_secret,
        sgdb_key=req.steamgriddb_api_key,
        steam_api_key=req.steam_web_api_key,
        itad_key=req.itad_api_key,
    )
    # Invalidate existing twitch token cache so fresh token is fetched with new credentials
    twitch_auth_manager.invalidate_token()
    return await get_integration_status(db)


@router.post("/shutdown", response_model=ShutdownResponse)
async def shutdown_system():
    """Triggers graceful shutdown of the local sidecar server."""
    if _shutdown_trigger:
        import asyncio
        asyncio.get_running_loop().call_soon(_shutdown_trigger)
    return ShutdownResponse(status="shutting_down")


@router.get("/logs")
async def get_system_logs(
    level: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 500,
):
    """Retrieves live in-memory logs formatted for the frontend Log Viewer."""
    from app.core.logging import log_buffer
    logs = log_buffer.get_logs(level=level, search=search, limit=limit)
    return {
        "total": len(logs),
        "buffer_total": log_buffer.total_count,
        "logs": logs,
    }


@router.delete("/logs")
async def clear_system_logs():
    """Clears the live in-memory log buffer."""
    from app.core.logging import log_buffer
    log_buffer.clear()
    return {"status": "cleared"}
