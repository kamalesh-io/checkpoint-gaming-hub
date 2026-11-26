"""Integration tests for Phase 6 Steam and Game Launcher API endpoints."""
import pytest
from unittest.mock import AsyncMock, patch

from app.models.game import Game
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus
from app.models.steam import SteamAccount


@pytest.mark.asyncio
async def test_steam_status_and_disconnect(client, db_session):
    """Verifies Steam status check and graceful disconnection without data loss."""
    # 1. Initial status before connection
    res = await client.get("/api/v1/steam/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_connected"] is False

    # 2. Add connected SteamAccount
    account = SteamAccount(
        steam_id_64="76561198000000001",
        persona_name="GamerAlpha",
        community_visibility_state=3,
        is_connected=True,
    )
    db_session.add(account)
    await db_session.commit()

    # 3. Status check should return connected account
    res = await client.get("/api/v1/steam/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_connected"] is True
    assert data["persona_name"] == "GamerAlpha"

    # 4. Disconnect account
    dc_res = await client.post("/api/v1/steam/disconnect")
    assert dc_res.status_code == 200

    # 5. Verify disconnected state
    res = await client.get("/api/v1/steam/status")
    assert res.status_code == 200
    assert res.json()["is_connected"] is False


@pytest.mark.asyncio
async def test_steam_import_data_preservation(client, db_session):
    """Verifies that Steam library sync preserves existing user progress, ratings, and notes."""
    # 1. Create existing game with manual user progress
    game = Game(
        igdb_id=109153,
        title="Cyberpunk 2077",
        slug="cyberpunk-2077",
        steam_app_id=1091500,
    )
    db_session.add(game)
    await db_session.flush()

    entry = LibraryEntry(
        game_id=game.id,
        playing_status=PlayingStatus.COMPLETED.value,
        ownership_status=OwnershipStatus.OWNED.value,
        hours_played=85.5,
        personal_rating=9.5,
        progress_pct=100.0,
        notes="Masterpiece storyline.",
    )
    db_session.add(entry)

    account = SteamAccount(
        steam_id_64="76561198000000001",
        is_connected=True,
    )
    db_session.add(account)
    await db_session.commit()

    # 2. Mock Steam GetOwnedGames returning 12000 minutes (200 hours)
    mock_games = [
        {
            "appid": 1091500,
            "name": "Cyberpunk 2077",
            "playtime_forever": 12000,
            "rtime_last_played": 1700000000,
        }
    ]

    with patch("app.services.steam_sync.SteamSyncService.fetch_steam_owned_games", new_callable=AsyncMock) as mock_fetch, \
         patch("app.core.config.Settings.get_steam_web_api_key", return_value="dummy_key"):
        mock_fetch.return_value = (True, mock_games, "OK")

        # Execute import
        res = await client.post("/api/v1/steam/import", json={"app_ids": [1091500]})
        assert res.status_code == 200
        res_data = res.json()
        assert res_data["updated_count"] == 1

    # 3. Refresh and verify user fields are preserved
    await db_session.refresh(entry)
    assert entry.playing_status == PlayingStatus.COMPLETED.value
    assert entry.hours_played == 85.5  # Honest manual hours NOT overwritten!
    assert entry.personal_rating == 9.5
    assert entry.notes == "Masterpiece storyline."
    assert entry.steam_playtime_minutes == 12000  # Kept in separate field!
