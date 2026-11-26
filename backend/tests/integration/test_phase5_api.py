"""Comprehensive integration tests for Phase 5 Gaming Management endpoints."""
import datetime
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient


MOCK_GAME = {
    "igdb_id": 119133,
    "title": "Elden Ring",
    "slug": "elden-ring",
    "summary": "Action RPG by FromSoftware",
    "release_year": 2022,
    "igdb_rating": 95.0,
    "developer": "FromSoftware",
    "publisher": "Bandai Namco",
    "steam_app_id": 1245620,
    "cover_url": "https://images.igdb.com/igdb/image/upload/t_1080p/co4jni.jpg",
    "genres": [{"name": "Role-playing (RPG)", "slug": "rpg"}],
    "themes": [{"name": "Fantasy", "slug": "fantasy"}],
    "platforms": ["PC"],
}


@pytest.mark.asyncio
async def test_phase5_full_feature_suite(client: AsyncClient):
    """Verifies Backlog, Planner, Sessions, Collections, Journal, Stats, Wishlist, Settings & Backup."""
    with patch("app.services.library.igdb_client.get_game_details", new_callable=AsyncMock) as mock_igdb, \
         patch("app.services.library.steamgriddb_client.get_all_artwork", new_callable=AsyncMock) as mock_sgdb, \
         patch("app.services.library.artwork_cache.download_and_cache", new_callable=AsyncMock) as mock_cache:

        mock_igdb.return_value = MOCK_GAME
        mock_sgdb.return_value = {"sgdb_id": 123, "grids": [], "heroes": [], "logos": []}
        mock_cache.return_value = {
            "local_path": "C:/fake/covers/elden.png",
            "sha256_hash": "elden123",
            "width": 600,
            "height": 900,
            "file_size_bytes": 1000,
            "mime_type": "image/png",
            "is_animated": False,
        }

        # Setup: Add a game to library
        add_resp = await client.post(
            "/api/v1/library",
            json={"igdb_id": 119133, "playing_status": "Planned", "priority": "High"},
        )
        assert add_resp.status_code == 201
        entry_id = add_resp.json()["id"]

        # ---------------- 1. Phase 5A: Backlog Management ----------------
        # Get backlog summary
        backlog_res = await client.get("/api/v1/backlog")
        assert backlog_res.status_code == 200
        b_data = backlog_res.json()
        assert b_data["total_planned"] >= 1
        assert b_data["up_next"] is not None
        assert b_data["up_next"]["id"] == entry_id

        # Set as next
        set_next_res = await client.post(
            "/api/v1/backlog/set-next",
            json={"entry_id": entry_id},
        )
        assert set_next_res.status_code == 200
        assert set_next_res.json()["up_next"]["queue_position"] == 1

        # Move item
        move_res = await client.post(
            f"/api/v1/backlog/{entry_id}/move",
            json={"direction": "up"},
        )
        assert move_res.status_code == 200

        # ---------------- 2. Phase 5B: Gaming Planner ----------------
        now = datetime.datetime.now(datetime.timezone.utc)
        plan_start = (now + datetime.timedelta(days=1)).isoformat()
        create_plan_res = await client.post(
            "/api/v1/planner/sessions",
            json={
                "library_entry_id": entry_id,
                "scheduled_start": plan_start,
                "duration_minutes": 120,
                "notes": "Defeat Margit the Fell Omen",
            },
        )
        assert create_plan_res.status_code == 201
        plan_session_id = create_plan_res.json()["id"]

        # List scheduled sessions
        list_plan_res = await client.get("/api/v1/planner/sessions")
        assert list_plan_res.status_code == 200
        assert len(list_plan_res.json()) >= 1

        # Check overlapping conflict detection
        conflict_res = await client.post(
            "/api/v1/planner/sessions",
            json={
                "library_entry_id": entry_id,
                "scheduled_start": plan_start,
                "duration_minutes": 60,
            },
        )
        assert conflict_res.status_code == 201
        assert conflict_res.json()["conflict_warning"] is not None

        # Complete scheduled session and log playtime
        complete_plan_res = await client.post(
            f"/api/v1/planner/sessions/{plan_session_id}/complete",
            json={"actual_duration_minutes": 90, "log_as_play_session": True},
        )
        assert complete_plan_res.status_code == 200
        assert complete_plan_res.json()["status"] == "Completed"

        # ---------------- 3. Phase 5C: Play Sessions Tracking ----------------
        # Start active session
        start_act_res = await client.post(
            "/api/v1/sessions/start",
            json={"library_entry_id": entry_id, "location_or_chapter": "Stormveil Castle"},
        )
        assert start_act_res.status_code == 200
        assert start_act_res.json()["library_entry_id"] == entry_id

        # Check active session persistence
        get_act_res = await client.get("/api/v1/sessions/active")
        assert get_act_res.status_code == 200
        assert get_act_res.json()["location_or_chapter"] == "Stormveil Castle"

        # Pause and resume
        pause_res = await client.post("/api/v1/sessions/pause")
        assert pause_res.status_code == 200
        assert pause_res.json()["is_paused"] is True

        resume_res = await client.post("/api/v1/sessions/resume")
        assert resume_res.status_code == 200
        assert resume_res.json()["is_paused"] is False

        # End active session
        end_act_res = await client.post(
            "/api/v1/sessions/end",
            json={"notes": "Explored courtyard and discovered secret route", "progress_pct": 25.0},
        )
        assert end_act_res.status_code == 200
        assert end_act_res.json()["duration_minutes"] >= 1

        # Manual session logging
        manual_res = await client.post(
            "/api/v1/sessions/manual",
            json={"library_entry_id": entry_id, "duration_minutes": 45, "notes": "Farmed runes"},
        )
        assert manual_res.status_code == 201

        # History list
        hist_res = await client.get(f"/api/v1/sessions/history?entry_id={entry_id}")
        assert hist_res.status_code == 200
        assert len(hist_res.json()) >= 2

        # ---------------- 4. Phase 5D: Collections & Franchises ----------------
        # Create collection
        col_res = await client.post(
            "/api/v1/collections",
            json={"name": "Soulsborne Favorites", "description": "FromSoftware challenging masterpieces", "is_pinned": True},
        )
        assert col_res.status_code == 201
        col_id = col_res.json()["id"]

        # Add item to collection
        add_col_item = await client.post(
            f"/api/v1/collections/{col_id}/items",
            json={"library_entry_id": entry_id},
        )
        assert add_col_item.status_code == 200
        assert add_col_item.json()["game_count"] == 1

        # List collections
        list_col_res = await client.get("/api/v1/collections")
        assert list_col_res.status_code == 200
        assert len(list_col_res.json()) >= 1

        # Franchises
        fran_res = await client.get("/api/v1/franchises")
        assert fran_res.status_code == 200

        # ---------------- 5. Phase 5E: Gaming Journal ----------------
        # Create journal entry
        jour_res = await client.post(
            "/api/v1/journal",
            json={
                "library_entry_id": entry_id,
                "title": "Margit Defeated at Level 24",
                "content_markdown": "Used spirit jellyfish and bloodhound fang bleed build.",
                "entry_type": "Boss Fight",
                "is_spoiler": True,
                "personal_rating": 9.5,
            },
        )
        assert jour_res.status_code == 201
        jour_id = jour_res.json()["id"]

        # List journal entries
        list_jour_res = await client.get(f"/api/v1/journal?entry_id={entry_id}")
        assert list_jour_res.status_code == 200
        assert len(list_jour_res.json()) >= 1

        # ---------------- 6. Phase 5F: Gaming Statistics ----------------
        stats_res = await client.get("/api/v1/stats")
        assert stats_res.status_code == 200
        s_data = stats_res.json()
        assert s_data["total_games"] >= 1
        assert s_data["total_hours_logged"] > 0
        assert len(s_data["most_played_games"]) >= 1

        # ---------------- 7. Phase 5G: Wishlist Improvements ----------------
        with patch("app.services.library.igdb_client.get_game_details", new_callable=AsyncMock) as mock_igdb2:
            mock_igdb2.return_value = {
                "id": 80529,
                "name": "Hades",
                "slug": "hades",
                "summary": "Rogue-like dungeon crawler",
                "first_release_date": 1600300800,
                "rating": 93.0,
            }
            # Add to wishlist
            wl_create_res = await client.post(
                "/api/v1/wishlist",
                json={"igdb_id": 80529, "priority": "High", "target_price": 499.0, "currency": "INR", "store_preference": "Steam"},
            )
            assert wl_create_res.status_code == 201
            wl_item_id = wl_create_res.json()["id"]

            # List wishlist
            wl_list = await client.get("/api/v1/wishlist")
            assert wl_list.status_code == 200
            assert any(item["id"] == wl_item_id for item in wl_list.json())

            # Convert wishlist item to library
            convert_res = await client.post(
                f"/api/v1/wishlist/{wl_item_id}/convert-to-library",
                json={"playing_status": "Planned", "ownership_status": "Owned", "platform": "Steam"},
            )
            assert convert_res.status_code == 200

        # ---------------- 8. Phase 5H: Application Settings ----------------
        # Set setting
        set_res = await client.put(
            "/api/v1/settings/ui_theme",
            json={"value": {"accent": "accent-gold", "animation_mode": "full"}},
        )
        assert set_res.status_code == 200

        # Get settings
        get_settings = await client.get("/api/v1/settings")
        assert get_settings.status_code == 200
        assert "ui_theme" in get_settings.json()

        # ---------------- 9. Phase 5I: Backup & Import/Export ----------------
        # Create SQLite backup
        backup_res = await client.post("/api/v1/system/backup")
        assert backup_res.status_code == 201
        backup_filename = backup_res.json()["backup_filename"]

        # List backups
        list_backups = await client.get("/api/v1/system/backup/list")
        assert list_backups.status_code == 200
        assert any(b["filename"] == backup_filename for b in list_backups.json())

        # Export JSON
        export_res = await client.get("/api/v1/system/backup/export-json")
        assert export_res.status_code == 200
        export_data = export_res.json()
        assert export_data["format"] == "checkpoint-portable-v1"
        assert len(export_data["library_games"]) >= 1

        # Import JSON
        import_res = await client.post(
            "/api/v1/system/backup/import-json",
            json=export_data,
        )
        assert import_res.status_code == 200
        assert import_res.json()["skipped_duplicates"] >= 1

        # Clear artwork cache
        clear_res = await client.post("/api/v1/system/backup/clear-cache")
        assert clear_res.status_code == 200
        assert clear_res.json()["status"] == "success"
