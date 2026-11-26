"""Game launch configuration and security validation service."""
import os
from pathlib import Path
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.models.library import LibraryEntry
from app.schemas.steam import LaunchConfigResponse, SetLaunchConfigRequest
from app.services.game_detector import GameDetectorService


class GameLauncherService:
    """Manages verified launch configurations for Steam and local desktop executable games."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_launch_config(self, game_id: str) -> LaunchConfigResponse:
        """Retrieves and validates launch parameters for a specific game."""
        result = await self.session.execute(
            select(Game, LibraryEntry)
            .join(LibraryEntry, Game.id == LibraryEntry.game_id)
            .where(Game.id == game_id)
        )
        row = result.first()
        if not row:
            raise ValueError("Game or library entry not found.")

        game, entry = row

        # Check installed Steam games
        is_installed = False
        if game.steam_app_id:
            installed_list = GameDetectorService.scan_installed_steam_games()
            is_installed = any(inst.steam_app_id == game.steam_app_id for inst in installed_list)

        if entry.executable_path:
            p = Path(entry.executable_path)
            if p.exists() and p.is_file():
                is_installed = True

        launch_type = "unconfigured"
        if game.steam_app_id:
            launch_type = "steam"
        elif entry.executable_path:
            launch_type = "executable"

        return LaunchConfigResponse(
            game_id=game.id,
            title=game.title,
            launch_type=launch_type,
            steam_app_id=game.steam_app_id,
            executable_path=entry.executable_path,
            launch_arguments=entry.launch_arguments,
            is_installed=is_installed,
        )

    async def update_launch_config(
        self, game_id: str, request: SetLaunchConfigRequest
    ) -> LaunchConfigResponse:
        """Sets custom executable path and launch arguments with strict security validation."""
        result = await self.session.execute(
            select(Game, LibraryEntry)
            .join(LibraryEntry, Game.id == LibraryEntry.game_id)
            .where(Game.id == game_id)
        )
        row = result.first()
        if not row:
            raise ValueError("Game or library entry not found.")

        game, entry = row

        if request.executable_path is not None:
            clean_path = request.executable_path.strip()
            if clean_path:
                p = Path(clean_path).resolve()
                if not p.exists() or not p.is_file():
                    raise ValueError(f"Target executable does not exist at '{clean_path}'.")
                if p.suffix.lower() != ".exe":
                    raise ValueError("Launch targets must be Windows executable files (.exe). Shell scripts (.bat, .cmd, .ps1) are prohibited.")
                entry.executable_path = str(p)
            else:
                entry.executable_path = None

        if request.launch_arguments is not None:
            clean_args = request.launch_arguments.strip()
            # Prevent command chaining or redirection
            if any(char in clean_args for char in [";", "&", "|", "`", ">", "<"]):
                raise ValueError("Dangerous shell metacharacters are forbidden in launch arguments.")
            entry.launch_arguments = clean_args if clean_args else None

        await self.session.commit()
        return await self.get_launch_config(game_id)
