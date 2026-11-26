"""SteamGridDB API Client for high-resolution covers, heroes, and logos."""
import re
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.core.exceptions import ExternalApiException
from app.core.logging import logger
from app.core.rate_limiter import APIRateLimiter

SGDB_BASE_URL = "https://www.steamgriddb.com/api/v2"


class SteamGridDBClient:
    """Asynchronous client for SteamGridDB v2 API."""

    def __init__(self):
        self.rate_limiter = APIRateLimiter(requests_per_second=4.0)

    def _get_headers(self) -> Dict[str, str]:
        key = settings.STEAMGRIDDB_API_KEY.get_secret_value() if settings.STEAMGRIDDB_API_KEY else ""
        if not key:
            logger.warning("STEAMGRIDDB_API_KEY is not configured.")
        return {
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        }

    async def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Makes an authenticated GET request to SteamGridDB."""
        if not settings.STEAMGRIDDB_API_KEY:
            return None

        async with self.rate_limiter:
            try:
                async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                    response = await client.get(
                        f"{SGDB_BASE_URL}/{endpoint}",
                        headers=self._get_headers(),
                        params=params,
                    )
                    if response.status_code == 404:
                        return None
                    if response.status_code != 200:
                        logger.warning(f"SteamGridDB error [{response.status_code}] on {endpoint}")
                        return None
                    data = response.json()
                    if data.get("success"):
                        return data.get("data")
                    return None
            except Exception as exc:
                logger.error(f"SteamGridDB network error on {endpoint}: {exc}")
                return None

    async def find_game_id(self, game_title: str, steam_app_id: Optional[int] = None) -> Optional[int]:
        """Resolves SteamGridDB game ID prioritizing Steam App ID over title search."""
        # 1. Steam App ID check (100% accurate)
        if steam_app_id:
            data = await self._get(f"games/by-steam/{steam_app_id}")
            if data and isinstance(data, dict) and "id" in data:
                return data["id"]

        # 2. Autocomplete search by title
        clean_title = re.sub(r"[^a-zA-Z0-9\s]", "", game_title).strip()
        data = await self._get(f"search/autocomplete/{clean_title}")
        if data and isinstance(data, list) and len(data) > 0:
            # Return the first high-confidence match
            return data[0]["id"]

        return None

    async def get_portrait_grids(self, sgdb_game_id: int) -> List[Dict[str, Any]]:
        """Retrieves portrait covers (2:3 aspect ratio, 600x900)."""
        data = await self._get(f"grids/game/{sgdb_game_id}", params={"dimensions": "600x900", "types": "static"})
        if not data or not isinstance(data, list):
            # Fallback to any portrait dimensions
            data = await self._get(f"grids/game/{sgdb_game_id}", params={"styles": "alternate,material", "types": "static"})
        if not data or not isinstance(data, list):
            return []
        return [
            {
                "id": item["id"],
                "url": item["url"],
                "thumb": item.get("thumb", item["url"]),
                "width": item.get("width", 600),
                "height": item.get("height", 900),
                "author": item.get("author", {}).get("name") if isinstance(item.get("author"), dict) else None,
                "score": item.get("score", 0),
            }
            for item in data
            if item.get("url")
        ]

    async def get_heroes(self, sgdb_game_id: int) -> List[Dict[str, Any]]:
        """Retrieves 16:9 landscape hero backgrounds."""
        data = await self._get(f"heroes/game/{sgdb_game_id}", params={"types": "static"})
        if not data or not isinstance(data, list):
            return []
        return [
            {
                "id": item["id"],
                "url": item["url"],
                "thumb": item.get("thumb", item["url"]),
                "width": item.get("width", 1920),
                "height": item.get("height", 1080),
                "author": item.get("author", {}).get("name") if isinstance(item.get("author"), dict) else None,
                "score": item.get("score", 0),
            }
            for item in data
            if item.get("url")
        ]

    async def get_logos(self, sgdb_game_id: int) -> List[Dict[str, Any]]:
        """Retrieves transparent title logos (PNG)."""
        data = await self._get(f"logos/game/{sgdb_game_id}", params={"types": "static"})
        if not data or not isinstance(data, list):
            return []
        return [
            {
                "id": item["id"],
                "url": item["url"],
                "thumb": item.get("thumb", item["url"]),
                "width": item.get("width", 800),
                "height": item.get("height", 300),
                "author": item.get("author", {}).get("name") if isinstance(item.get("author"), dict) else None,
                "score": item.get("score", 0),
            }
            for item in data
            if item.get("url")
        ]

    async def get_all_artwork(self, game_title: str, steam_app_id: Optional[int] = None) -> Dict[str, Any]:
        """Convenience method resolving all SteamGridDB artwork categories for a game."""
        sgdb_id = await self.find_game_id(game_title, steam_app_id)
        if not sgdb_id:
            return {"sgdb_id": None, "grids": [], "heroes": [], "logos": []}

        import asyncio
        grids, heroes, logos = await asyncio.gather(
            self.get_portrait_grids(sgdb_id),
            self.get_heroes(sgdb_id),
            self.get_logos(sgdb_id),
            return_exceptions=True,
        )

        return {
            "sgdb_id": sgdb_id,
            "grids": grids if isinstance(grids, list) else [],
            "heroes": heroes if isinstance(heroes, list) else [],
            "logos": logos if isinstance(logos, list) else [],
        }


steamgriddb_client = SteamGridDBClient()
