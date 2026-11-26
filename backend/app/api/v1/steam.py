"""API router for Steam Account, Library Synchronization, and Achievements."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.steam import (
    GameAchievementsResponse,
    SteamAccountStatus,
    SteamConnectRequest,
    SteamImportExecuteRequest,
    SteamImportExecuteResponse,
    SteamImportPreviewResponse,
    SteamTestConnectionRequest,
    SteamTestConnectionResponse,
)
from app.services.steam import SteamService
from app.services.steam_achievements import SteamAchievementService
from app.services.steam_sync import SteamSyncService


router = APIRouter(prefix="/steam", tags=["Steam Integration"])


@router.get("/status", response_model=SteamAccountStatus)
async def get_steam_status(db: AsyncSession = Depends(get_db)) -> SteamAccountStatus:
    """Retrieves connection state and metadata of linked Steam account."""
    service = SteamService(db)
    return await service.get_account_status()


@router.post("/test", response_model=SteamTestConnectionResponse)
async def test_steam_connection(
    request: SteamTestConnectionRequest, db: AsyncSession = Depends(get_db)
) -> SteamTestConnectionResponse:
    """Tests SteamID and API key reachability without saving credentials."""
    service = SteamService(db)
    return await service.test_connection(request.steam_id_64, request.api_key)


@router.post("/connect", response_model=SteamAccountStatus)
async def connect_steam_account(
    request: SteamConnectRequest, db: AsyncSession = Depends(get_db)
) -> SteamAccountStatus:
    """Links Steam account, securely saves API key via DPAPI, and saves profile."""
    service = SteamService(db)
    try:
        return await service.connect_account(
            identifier=request.steam_id_64,
            api_key_override=request.api_key,
            auto_sync=request.auto_sync_enabled,
            sync_interval=request.sync_interval_hours,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/disconnect")
async def disconnect_steam_account(db: AsyncSession = Depends(get_db)) -> dict:
    """Disconnects linked Steam account without modifying personal library entries."""
    service = SteamService(db)
    await service.disconnect_account()
    return {"status": "disconnected", "message": "Steam account disconnected successfully."}


@router.post("/preview", response_model=SteamImportPreviewResponse)
async def get_import_preview(db: AsyncSession = Depends(get_db)) -> SteamImportPreviewResponse:
    """Scans Steam account library and categorizes titles into new, existing, and unmatched."""
    sync_service = SteamSyncService(db)
    try:
        return await sync_service.generate_import_preview()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/import", response_model=SteamImportExecuteResponse)
async def execute_library_import(
    request: SteamImportExecuteRequest, db: AsyncSession = Depends(get_db)
) -> SteamImportExecuteResponse:
    """Imports selected games into Checkpoint library, strictly preserving user progress."""
    sync_service = SteamSyncService(db)
    try:
        return await sync_service.execute_import(
            app_ids=request.app_ids,
            ownership_overrides=request.ownership_status_overrides,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/games/{game_id}/achievements", response_model=GameAchievementsResponse)
async def get_game_achievements(
    game_id: str,
    refresh: bool = Query(False, description="Force live sync from Steam"),
    db: AsyncSession = Depends(get_db),
) -> GameAchievementsResponse:
    """Retrieves cached or synchronized achievements for a library game."""
    service = SteamAchievementService(db)
    return await service.get_achievements(game_id, force_refresh=refresh)


@router.post("/games/{game_id}/achievements/sync", response_model=GameAchievementsResponse)
async def sync_game_achievements(
    game_id: str, db: AsyncSession = Depends(get_db)
) -> GameAchievementsResponse:
    """Forces synchronization of achievements from Steam Web API."""
    service = SteamAchievementService(db)
    return await service.get_achievements(game_id, force_refresh=True)
