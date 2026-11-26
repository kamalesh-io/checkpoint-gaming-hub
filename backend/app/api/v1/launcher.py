"""API router for game launching, local executable configuration, and running game detection."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.steam import (
    DetectorStatusResponse,
    InstalledGameInfo,
    LaunchConfigResponse,
    SetLaunchConfigRequest,
)
from app.services.game_detector import GameDetectorService
from app.services.launcher import GameLauncherService


router = APIRouter(prefix="/launcher", tags=["Game Launcher"])


@router.get("/status", response_model=DetectorStatusResponse)
async def get_detector_status(db: AsyncSession = Depends(get_db)) -> DetectorStatusResponse:
    """Polls running processes and returns active gameplay monitoring status."""
    service = GameDetectorService(db)
    return await service.poll_gameplay_monitoring()


@router.get("/installed-steam", response_model=List[InstalledGameInfo])
async def list_installed_steam_games() -> List[InstalledGameInfo]:
    """Scans all local Steam library folders and returns installed games."""
    return GameDetectorService.scan_installed_steam_games()


@router.get("/games/{game_id}", response_model=LaunchConfigResponse)
async def get_game_launch_config(
    game_id: str, db: AsyncSession = Depends(get_db)
) -> LaunchConfigResponse:
    """Retrieves verified launch configuration for a game."""
    service = GameLauncherService(db)
    try:
        return await service.get_launch_config(game_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/games/{game_id}", response_model=LaunchConfigResponse)
async def update_game_launch_config(
    game_id: str, request: SetLaunchConfigRequest, db: AsyncSession = Depends(get_db)
) -> LaunchConfigResponse:
    """Configures verified local executable path with security validation."""
    service = GameLauncherService(db)
    try:
        return await service.update_launch_config(game_id, request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
