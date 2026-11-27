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

        # D. Quoted path normalization
        config = await launcher.update_launch_config(
            game.id,
            SetLaunchConfigRequest(
                executable_path='"C:/Games/game.exe"',
                launch_arguments="-dx11",
                minimize_on_launch=True,
            ),
        )
        from pathlib import Path
        assert Path(config.executable_path) == Path("C:/Games/game.exe")
        assert config.launch_arguments == "-dx11"


def test_known_edition_aliases():
    """Ensures base and enhanced/remastered edition AppIDs are correctly linked."""
    from app.services.game_detector import KNOWN_EDITION_ALIASES

    # Metro Exodus (Base 412020 <-> Enhanced 1449560)
    assert 1449560 in KNOWN_EDITION_ALIASES[412020]
    assert 412020 in KNOWN_EDITION_ALIASES[1449560]

    # Witcher 3 (Base 292030 <-> Complete 499450)
    assert 499450 in KNOWN_EDITION_ALIASES[292030]
    assert 292030 in KNOWN_EDITION_ALIASES[499450]


def test_find_primary_game_executable(tmp_path):
    """Verifies executable finder discovers binaries in subdirectories and ignores installers."""
    from pathlib import Path
    from app.services.game_detector import find_primary_game_executable

    # Create dummy game directory with an engine subfolder
    bin_dir = tmp_path / "bin" / "x64"
    bin_dir.mkdir(parents=True)

    # Add a crash reporter and uninstaller that should be ignored
    (tmp_path / "CrashReportClient.exe").write_text("dummy")
    (tmp_path / "unins000.exe").write_text("dummy")

    # Add actual primary game binary
    game_exe = bin_dir / "MetroExodus.exe"
    game_exe.write_text("dummy")

    found = find_primary_game_executable(tmp_path, "Metro Exodus")
    assert found is not None
    assert Path(found).name.lower() == "metroexodus.exe"


def test_artwork_cache_domain_validation():
    """Verifies that approved gaming CDN domains are allowed and untrusted domains rejected."""
    from app.core.exceptions import SecurityException
    from app.services.artwork_cache import ArtworkCacheService

    cache_service = ArtworkCacheService()

    # Valid URLs
    cache_service._validate_url("https://cdn2.steamgriddb.com/grid/abc123.jpg")
    cache_service._validate_url("https://images.steamgriddb.com/hero/abc.png")
    cache_service._validate_url("https://shared.steamstatic.com/store_item_assets/steam/apps/412020/library_600x900.jpg")
    cache_service._validate_url("https://media.steampowered.com/steamcommunity/public/images/apps/412020/icon.jpg")
    cache_service._validate_url("https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg")

    # Untrusted URLs must raise SecurityException
    with pytest.raises(SecurityException, match="approved artwork whitelist"):
        cache_service._validate_url("https://malicious-site.com/payload.exe")

    with pytest.raises(SecurityException, match="Unsupported URL scheme"):
        cache_service._validate_url("file:///etc/passwd")


@pytest.mark.asyncio
async def test_steam_import_preview_fast_o1(db_session):
    """Verifies Steam import preview executes instantaneously without O(N) external search bottleneck."""
    from app.models.steam import SteamAccount
    from app.services.steam_sync import SteamSyncService

    # 1. Connect mock Steam account
    account = SteamAccount(
        steam_id_64="76561198012345678",
        persona_name="TestGamer",
        is_connected=True,
    )
    db_session.add(account)

    # 2. Add an existing local game (Metro Exodus)
    game = Game(
        igdb_id=26226,
        title="Metro Exodus",
        slug="metro-exodus",
        steam_app_id=412020,
    )
    db_session.add(game)
    await db_session.flush()

    entry = LibraryEntry(
        game_id=game.id,
        ownership_status=OwnershipStatus.OWNED.value,
        platform="Steam",
    )
    db_session.add(entry)
    await db_session.commit()

    service = SteamSyncService(db_session)

    # Mock fetch_steam_owned_games returning 3 games (1 existing, 2 new)
    mock_games = [
        {"appid": 412020, "name": "Metro Exodus", "playtime_forever": 1200, "rtime_last_played": 1700000000},
        {"appid": 1091500, "name": "Cyberpunk 2077", "playtime_forever": 3600, "rtime_last_played": 1700500000},
        {"appid": 1245620, "name": "Elden Ring", "playtime_forever": 7200, "rtime_last_played": 1701000000},
    ]

    with patch.object(service, "fetch_steam_owned_games", AsyncMock(return_value=(True, mock_games, "OK"))), \
         patch("app.core.config.Settings.get_steam_web_api_key", return_value="dummy_key"):
        preview = await service.generate_import_preview()

        assert preview.total_found == 3
        # Metro Exodus is in local DB with an entry -> existing_games
        assert len(preview.existing_games) == 1
        assert preview.existing_games[0].steam_app_id == 412020
        assert preview.existing_games[0].already_imported is True

        # Cyberpunk 2077 and Elden Ring are unimported -> new_games with Steam CDN capsules
        assert len(preview.new_games) == 2
        app_ids = [g.steam_app_id for g in preview.new_games]
        assert 1091500 in app_ids
        assert 1245620 in app_ids
        for g in preview.new_games:
            assert "library_600x900.jpg" in g.cover_url
            assert g.already_imported is False

