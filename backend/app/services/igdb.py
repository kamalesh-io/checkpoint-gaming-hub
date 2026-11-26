"""IGDB v4 API Client with Apicalypse query formatting and rate limiting."""
import datetime
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.core.exceptions import ExternalApiException, RateLimitException
from app.core.logging import logger
from app.core.rate_limiter import APIRateLimiter
from app.services.game_matching import extract_steam_app_id_from_external_games, score_search_candidate
from app.services.twitch_auth import twitch_auth_manager

IGDB_BASE_URL = "https://api.igdb.com/v4"


def format_igdb_image_url(url: Optional[str], size: str = "t_cover_big") -> Optional[str]:
    """Normalizes IGDB image URLs to HTTPS and specified dimensions."""
    if not url:
        return None
    normalized = url
    if normalized.startswith("//"):
        normalized = "https:" + normalized
    elif not normalized.startswith("http"):
        normalized = "https://" + normalized

    # Replace size placeholder
    for s in ["t_thumb", "t_cover_small", "t_cover_big", "t_720p", "t_1080p", "t_screenshot_big", "t_screenshot_huge"]:
        if f"/{s}/" in normalized:
            return normalized.replace(f"/{s}/", f"/{size}/")
    return normalized


class IGDBClient:
    """Asynchronous client for querying the official IGDB v4 catalog."""

    def __init__(self):
        self.rate_limiter = APIRateLimiter(requests_per_second=settings.IGDB_REQUESTS_PER_SECOND)

    async def _post_query(self, endpoint: str, query: str, retry_auth: bool = True) -> List[Dict[str, Any]]:
        """Executes an Apicalypse query against IGDB with rate limiting and auth refresh."""
        token = await twitch_auth_manager.get_access_token()
        client_id = settings.get_igdb_client_id() or ""

        headers = {
            "Client-ID": client_id,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "text/plain",
        }

        async with self.rate_limiter:
            try:
                async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        f"{IGDB_BASE_URL}/{endpoint}",
                        content=query,
                        headers=headers,
                    )

                    # Handle token expiry
                    if response.status_code == 401 and retry_auth:
                        logger.warning("IGDB token expired, refreshing and retrying query...")
                        await twitch_auth_manager.get_access_token(force_refresh=True)
                        return await self._post_query(endpoint, query, retry_auth=False)

                    # Handle rate limiting
                    if response.status_code == 429:
                        retry_after = float(response.headers.get("Retry-After", 1.0))
                        logger.warning(f"IGDB rate limit hit. Waiting {retry_after}s...")
                        raise RateLimitException("IGDB rate limit hit", retry_after=retry_after)

                    if response.status_code != 200:
                        logger.error(f"IGDB request error [{response.status_code}]: {response.text}")
                        raise ExternalApiException(
                            message=f"IGDB API query failed: {response.text}",
                            code=f"IGDB_ERROR_{response.status_code}",
                            status_code=response.status_code,
                        )

                    return response.json()

            except httpx.RequestError as exc:
                logger.error(f"IGDB connection failure: {exc}")
                raise ExternalApiException(
                    message=f"Network error querying IGDB: {exc}",
                    code="IGDB_NETWORK_ERROR",
                )

    async def search_games(self, search_text: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Searches the IGDB catalog by title with intelligent base-game prioritization."""
        sanitized_query = search_text.replace('"', '\\"')
        fetch_limit = max(limit, 25)
        query = (
            f'search "{sanitized_query}"; '
            f"fields name, slug, summary, storyline, first_release_date, game_type, category, "
            f"version_parent, parent_game, total_rating, total_rating_count, "
            f"cover.image_id, cover.url, screenshots.image_id, screenshots.url, "
            f"genres.name, themes.name, platforms.name, platforms.abbreviation, "
            f"involved_companies.developer, involved_companies.publisher, involved_companies.company.name, "
            f"external_games.category, external_games.external_game_source, external_games.uid, external_games.url; "
            f"limit {fetch_limit};"
        )
        results = await self._post_query("games", query)
        if not results:
            return []

        # Sort candidates using base-game prioritization scoring without dropping editions/expansions
        results.sort(key=lambda item: score_search_candidate(item, search_text), reverse=True)
        top_candidates = results[:limit]
        return [self.normalize_search_item(item) for item in top_candidates]

    async def get_game_details(self, igdb_id: int) -> Optional[Dict[str, Any]]:
        """Fetches full game metadata for an IGDB game ID."""
        query = (
            f"where id = {igdb_id}; "
            f"fields name, slug, summary, storyline, first_release_date, game_type, category, "
            f"version_parent, parent_game, total_rating, total_rating_count, "
            f"cover.image_id, cover.url, screenshots.image_id, screenshots.url, artworks.image_id, artworks.url, "
            f"genres.name, genres.slug, themes.name, themes.slug, "
            f"platforms.name, platforms.abbreviation, "
            f"involved_companies.developer, involved_companies.publisher, involved_companies.company.name, "
            f"franchise.name, franchise.slug, collection.name, collection.slug, "
            f"external_games.category, external_games.external_game_source, external_games.uid, external_games.url; "
            f"limit 1;"
        )
        items = await self._post_query("games", query)
        if not items:
            return None
        return self.normalize_game_details(items[0])

    def normalize_search_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes IGDB search item payload."""
        release_year = None
        if item.get("first_release_date"):
            try:
                release_year = datetime.datetime.fromtimestamp(
                    item["first_release_date"], tz=datetime.timezone.utc
                ).year
            except Exception:
                pass

        developer = None
        publisher = None
        for comp in item.get("involved_companies", []):
            company_name = comp.get("company", {}).get("name")
            if comp.get("developer") and not developer:
                developer = company_name
            if comp.get("publisher") and not publisher:
                publisher = company_name

        cover_raw = item.get("cover", {}).get("url") if isinstance(item.get("cover"), dict) else None
        cover_url = format_igdb_image_url(cover_raw, "t_cover_big")

        genres = [g.get("name") for g in item.get("genres", []) if g.get("name")]
        platforms = [p.get("abbreviation") or p.get("name") for p in item.get("platforms", []) if p.get("name")]

        category_map = {
            0: "base_game",
            1: "dlc",
            2: "expansion",
            3: "bundle",
            4: "standalone_expansion",
            5: "mod",
            6: "episode",
            7: "season",
            8: "remake",
            9: "remaster",
            10: "expanded_game",
            11: "port",
            12: "fork",
            13: "pack",
            14: "update",
        }
        raw_gt = item.get("game_type", item.get("category", 0))
        gt_int = raw_gt if raw_gt is not None else 0
        if gt_int == 0 and item.get("version_parent"):
            category_label = "edition"
        else:
            category_label = category_map.get(gt_int, "base_game")

        return {
            "igdb_id": item["id"],
            "title": item.get("name", "Untitled"),
            "slug": item.get("slug", ""),
            "category": category_label,
            "game_type": gt_int,
            "version_parent": item.get("version_parent"),
            "parent_game": item.get("parent_game"),
            "release_year": release_year,
            "developer": developer,
            "publisher": publisher,
            "genres": genres,
            "platforms": platforms,
            "igdb_rating": item.get("total_rating"),
            "cover_url": cover_url,
            "in_library": False,
            "library_entry_id": None,
        }

    def normalize_game_details(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes full IGDB game details payload."""
        release_date = None
        if item.get("first_release_date"):
            try:
                release_date = datetime.datetime.fromtimestamp(
                    item["first_release_date"], tz=datetime.timezone.utc
                ).date()
            except Exception:
                pass

        developer = None
        publisher = None
        for comp in item.get("involved_companies", []):
            company_name = comp.get("company", {}).get("name")
            if comp.get("developer") and not developer:
                developer = company_name
            if comp.get("publisher") and not publisher:
                publisher = company_name

        cover_raw = item.get("cover", {}).get("url") if isinstance(item.get("cover"), dict) else None
        cover_url = format_igdb_image_url(cover_raw, "t_1080p")

        # Extract Steam App ID using external_game_source, category, or URL regex
        steam_app_id = extract_steam_app_id_from_external_games(item.get("external_games", []))

        franchise_name = None
        franchise_slug = None
        if item.get("franchise") and isinstance(item["franchise"], dict):
            franchise_name = item["franchise"].get("name")
            franchise_slug = item["franchise"].get("slug")
        elif item.get("collection") and isinstance(item["collection"], dict):
            franchise_name = item["collection"].get("name")
            franchise_slug = item["collection"].get("slug")

        screenshots = [
            format_igdb_image_url(s.get("url"), "t_1080p")
            for s in item.get("screenshots", [])
            if s.get("url")
        ]

        hero_url = screenshots[0] if screenshots else cover_url

        raw_gt = item.get("game_type", item.get("category", 0))
        game_type_val = raw_gt if raw_gt is not None else 0
        platforms = [p.get("abbreviation") or p.get("name") for p in item.get("platforms", []) if p.get("name")]

        return {
            "igdb_id": item["id"],
            "title": item.get("name", "Untitled"),
            "slug": item.get("slug", ""),
            "summary": item.get("summary"),
            "storyline": item.get("storyline"),
            "release_date": release_date,
            "developer": developer,
            "publisher": publisher,
            "igdb_rating": item.get("total_rating"),
            "igdb_rating_count": item.get("total_rating_count"),
            "game_type": str(game_type_val),
            "version_parent": item.get("version_parent"),
            "parent_game": item.get("parent_game"),
            "steam_app_id": steam_app_id,
            "cover_url": cover_url,
            "hero_url": hero_url,
            "screenshots": screenshots,
            "platforms": platforms,
            "franchise_name": franchise_name,
            "franchise_slug": franchise_slug,
            "genres": [
                {"id": g["id"], "name": g["name"], "slug": g.get("slug")}
                for g in item.get("genres", [])
                if g.get("id") and g.get("name")
            ],
            "themes": [
                {"id": t["id"], "name": t["name"], "slug": t.get("slug")}
                for t in item.get("themes", [])
                if t.get("id") and t.get("name")
            ],
            "raw_item": item,
        }


igdb_client = IGDBClient()
