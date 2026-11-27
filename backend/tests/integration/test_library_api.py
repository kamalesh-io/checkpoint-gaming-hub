"""Integration tests for Personal Library API endpoints."""

import datetime
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient


MOCK_GAME_DETAILS = {
    "igdb_id": 119133,
    "title": "Elden Ring",
    "slug": "elden-ring",
    "summary": "An epic dark fantasy action RPG developed by FromSoftware.",
    "storyline": "In the Lands Between, the Golden Order is broken...",
    "category": "base_game",
    "first_release_date": datetime.date(2022, 2, 25),
    "release_year": 2022,
    "igdb_rating": 95.8,
    "igdb_rating_count": 1420,
    "developer": "FromSoftware",
    "publisher": "Bandai Namco",
    "steam_app_id": 1245620,
    "cover_url": "https://images.igdb.com/igdb/image/upload/t_1080p/co4jni.jpg",
    "screenshots": ["https://images.igdb.com/igdb/image/upload/t_1080p/sc8d00.jpg"],
    "genres": [{"name": "Role-playing (RPG)", "slug": "role-playing-rpg"}],
    "themes": [{"name": "Fantasy", "slug": "fantasy"}],
    "platforms": ["PC", "PlayStation 5"],
}

MOCK_SGDB_DATA = {
    "sgdb_id": 5262799,
    "grids": [],
    "heroes": [],
    "logos": [],
}


@pytest.mark.asyncio
async def test_add_game_and_list_library(client: AsyncClient):
    """Verify adding a game to the library, duplicate rejection, and retrieval."""
    with patch("app.services.library.igdb_client.get_game_details", new_callable=AsyncMock) as mock_igdb, \
         patch("app.services.library.steamgriddb_client.get_all_artwork", new_callable=AsyncMock) as mock_sgdb, \
         patch("app.services.library.artwork_cache.download_and_cache", new_callable=AsyncMock) as mock_cache:

        mock_igdb.return_value = MOCK_GAME_DETAILS
        mock_sgdb.return_value = MOCK_SGDB_DATA
        mock_cache.return_value = {
            "local_path": "C:/temp/covers/abc123.png",
            "sha256_hash": "abc123",
            "width": 600,
            "height": 900,
            "file_size_bytes": 12345,
            "mime_type": "image/png",
            "is_animated": False,
        }

        # 1. Add game to library
        payload = {
            "igdb_id": 119133,
            "playing_status": "playing",
            "ownership_status": "owned",
            "platform": "PC",
            "priority": "high",
            "completion_goal": "main_story",
            "progress_pct": 35.0,
            "hours_played": 42.5,
            "personal_rating": 9.5,
            "notes": "Exploring Liurnia of the Lakes.",
        }
        res = await client.post("/api/v1/library", json=payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["game"]["title"] == "Elden Ring"
        assert data["game"]["platforms"] == ["PC", "PlayStation 5"]
        assert data["game"]["igdb_rating_count"] == 1420
        assert data["artwork"]["cover_url"] == "/api/v1/artwork/cache/covers/abc123.png"
        assert data["playing_status"] == "playing"
        assert data["ownership_status"] == "owned"
        assert data["progress_pct"] == 35.0
        entry_id = data["id"]

        # 2. Duplicate detection: Attempting to add same IGDB game again should fail with 409
        dup_res = await client.post("/api/v1/library", json=payload)
        assert dup_res.status_code == 409
        assert dup_res.json()["error"]["code"] == "DUPLICATE_ENTITY"

        # 3. Retrieve library list
        list_res = await client.get("/api/v1/library")
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["meta"]["total"] == 1
        assert len(list_data["data"]) == 1
        assert list_data["data"][0]["id"] == entry_id

        # 4. Filter by playing_status, ownership_status, genre
        filter_res = await client.get("/api/v1/library?status=completed")
        assert filter_res.status_code == 200
        assert filter_res.json()["meta"]["total"] == 0

        owner_res = await client.get("/api/v1/library?ownership_status=owned&genre=Role-playing%20(RPG)")
        assert owner_res.status_code == 200
        assert owner_res.json()["meta"]["total"] == 1

        # 5. Update library entry (including clearing nullable rating)
        update_payload = {
            "playing_status": "completed",
            "progress_pct": 100.0,
            "hours_played": 98.0,
            "personal_rating": None,
            "is_favorite": True,
        }
        patch_res = await client.patch(f"/api/v1/library/{entry_id}", json=update_payload)
        assert patch_res.status_code == 200
        updated_data = patch_res.json()
        assert updated_data["playing_status"] == "completed"
        assert updated_data["progress_pct"] == 100.0
        assert updated_data["personal_rating"] is None
        assert updated_data["is_favorite"] is True

        # 5b. Cache status & cached image serving endpoint check (including CORS header)
        cache_res = await client.get("/api/v1/artwork/cache/status")
        assert cache_res.status_code == 200
        assert cache_res.json()["status"] == "success"

        from app.core.config import settings
        covers_dir = settings.ARTWORK_CACHE_DIR / "covers"
        covers_dir.mkdir(parents=True, exist_ok=True)
        fake_png = covers_dir / "abc123.png"
        fake_png.write_bytes(b"\x89PNG\r\n\x1a\nfake")
        try:
            img_res = await client.get(
                "/api/v1/artwork/cache/covers/abc123.png",
                headers={"Origin": "http://localhost:5173"},
            )
            assert img_res.status_code == 200
            assert img_res.headers.get("access-control-allow-origin") == "http://localhost:5173"
            assert img_res.content.startswith(b"\x89PNG")
        finally:
            fake_png.unlink(missing_ok=True)

        # 6. Delete library entry
        del_res = await client.delete(f"/api/v1/library/{entry_id}")
        assert del_res.status_code == 204

        # 7. Confirm library is now empty
        empty_res = await client.get("/api/v1/library")
        assert empty_res.status_code == 200
        assert empty_res.json()["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_wishlist_decoupled_from_library_and_rating_update(client: AsyncClient):
    """BUG-013 & BUG-015: Ensure 'To Buy' items are decoupled from normal library queries and ratings can be set and cleared."""
    with patch("app.services.library.igdb_client.get_game_details", new_callable=AsyncMock) as mock_igdb, \
         patch("app.services.library.steamgriddb_client.get_all_artwork", new_callable=AsyncMock) as mock_sgdb, \
         patch("app.services.library.artwork_cache.download_and_cache", new_callable=AsyncMock) as mock_cache:

        mock_igdb.return_value = {
            "igdb_id": 2001,
            "title": "Wishlist Only Game",
            "slug": "wishlist-only-game",
            "summary": "Looking forward to this.",
            "first_release_date": datetime.date(2024, 1, 1),
            "igdb_rating": 85.0,
            "genres": [{"name": "Adventure", "slug": "adventure"}],
            "themes": [],
            "cover_url": "https://images.igdb.com/igdb/image/upload/t_1080p/cover2001.jpg",
            "screenshots": [],
        }
        mock_sgdb.return_value = {"covers": [], "heroes": [], "logos": [], "grids": []}
        mock_cache.return_value = None

        # 1. Add game with ownership_status = "To Buy" (Wishlist entry)
        payload = {
            "igdb_id": 2001,
            "playing_status": "Planned",
            "ownership_status": "To Buy",
            "platform": "Steam",
            "priority": "High",
            "completion_goal": "Main Story",
            "progress_pct": 0.0,
            "personal_rating": 8.5,
        }
        res = await client.post("/api/v1/library", json=payload)
        assert res.status_code == 201
        entry_id = res.json()["id"]

        # 2. BUG-015: Default library list must NOT include "To Buy" wishlist entry
        default_lib = await client.get("/api/v1/library")
        assert default_lib.status_code == 200
        ids = [e["id"] for e in default_lib.json()["data"]]
        assert entry_id not in ids
        assert default_lib.json()["meta"]["total"] == 0

        # 3. Explicit query with ownership_status="To Buy" DOES return the item
        wishlist_lib = await client.get("/api/v1/library?ownership_status=To+Buy")
        assert wishlist_lib.status_code == 200
        assert wishlist_lib.json()["meta"]["total"] == 1
        assert wishlist_lib.json()["data"][0]["id"] == entry_id

        # 4. BUG-013: Update progress and clear rating (personal_rating: null)
        patch_res = await client.patch(
            f"/api/v1/library/{entry_id}",
            json={"progress_pct": 50.0, "personal_rating": None, "ownership_status": "Owned"},
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["progress_pct"] == 50.0
        assert updated["personal_rating"] is None
        assert updated["ownership_status"] == "Owned"

        # 5. Now that it is "Owned", default library list includes it
        default_lib2 = await client.get("/api/v1/library")
        assert default_lib2.status_code == 200
        assert default_lib2.json()["meta"]["total"] == 1
        assert default_lib2.json()["data"][0]["id"] == entry_id

        # Cleanup
        await client.delete(f"/api/v1/library/{entry_id}")
