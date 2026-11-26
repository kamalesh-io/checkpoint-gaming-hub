"""Unit tests for Phase 6 services: Steam, Achievements, Detector, Launcher, and ITAD."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.game import Game
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus
from app.services.game_detector import EXCLUDED_PROCESS_NAMES, GameDetectorService
from app.services.launcher import GameLauncherService
from app.services.steam import SteamService


def test_steam_id_extraction():
    """Validates SteamID64 extraction from raw numbers, vanity paths, and full URLs."""
    # 1. Direct 17-digit number
    assert SteamService.extract_steam_id_64("76561198000000000") == "76561198000000000"
    assert SteamService.extract_steam_id_64("  76561198000000000  ") == "76561198000000000"

    # 2. Profile URL
    assert (
        SteamService.extract_steam_id_64("https://steamcommunity.com/profiles/76561198012345678/")
        == "76561198012345678"
    )
    assert (
        SteamService.extract_steam_id_64("http://steamcommunity.com/profiles/76561198012345678?xml=1")
        == "76561198012345678"
    )

    # 3. Non-numeric custom vanity URL should return None from direct extractor
    assert SteamService.extract_steam_id_64("https://steamcommunity.com/id/gabelogannell") is None
    assert SteamService.extract_steam_id_64("random_string") is None


def test_excluded_process_names():
    """Ensures major game launchers and crash handlers are permanently excluded from tracking."""
    assert "steam.exe" in EXCLUDED_PROCESS_NAMES
    assert "epicgameslauncher.exe" in EXCLUDED_PROCESS_NAMES
    assert "crashreporter.exe" in EXCLUDED_PROCESS_NAMES
    assert "unitycrashhandler64.exe" in EXCLUDED_PROCESS_NAMES
    assert "easyanticheat.exe" in EXCLUDED_PROCESS_NAMES
    assert "checkpoint.exe" in EXCLUDED_PROCESS_NAMES


@pytest.mark.asyncio
async def test_launcher_validation(db_session):
    """Verifies executable validation and injection prevention in launch configurations."""
    launcher = GameLauncherService(db_session)

    # Create dummy game and entry
    game = Game(igdb_id=99901, title="Test Indie", slug="test-indie-launcher")
    db_session.add(game)
    await db_session.flush()

    entry = LibraryEntry(game_id=game.id, platform="PC")
    db_session.add(entry)
    await db_session.commit()

    from app.schemas.steam import SetLaunchConfigRequest

    # A. Forbidden non-existent file
    with pytest.raises(ValueError, match="Target executable does not exist"):
        await launcher.update_launch_config(
            game.id, SetLaunchConfigRequest(executable_path="C:/Games/FakeGame/fake.exe")
        )

    # B. Forbidden script file
    with patch("pathlib.Path.exists", return_value=True), patch("pathlib.Path.is_file", return_value=True):
        with pytest.raises(ValueError, match="Launch targets must be Windows executable files"):
            await launcher.update_launch_config(
                game.id, SetLaunchConfigRequest(executable_path="C:/Games/game.bat")
            )

        # C. Forbidden dangerous shell arguments
        with pytest.raises(ValueError, match="Dangerous shell metacharacters"):
            await launcher.update_launch_config(
                game.id, SetLaunchConfigRequest(executable_path="C:/Games/game.exe", launch_arguments="--windowed; rm -rf /")
            )
