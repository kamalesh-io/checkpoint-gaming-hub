"""Library management service coordinating metadata, artwork caching, and persistence."""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import DuplicateEntityException, EntityNotFoundException
from app.core.logging import logger
from app.models.artwork import ArtworkSource, AssetType, GameArtwork
from app.models.game import Game
from app.models.library import LibraryEntry
from app.repositories.game_repo import GameRepository
from app.repositories.library_repo import LibraryRepository
from app.schemas.game import GameArtworkBundle, GameRead
from app.schemas.library import LibraryEntryCreate, LibraryEntryRead, LibraryEntryUpdate
from app.services.artwork_cache import artwork_cache
from app.services.igdb import igdb_client
from app.services.steamgriddb import steamgriddb_client


def resolve_active_accent(game_title: str) -> str:
    """Assigns an atmospheric dynamic accent token based on verified title heuristics."""
    t = game_title.lower()
    if "elden ring" in t or "dark souls" in t or "demon's souls" in t or "souls" in t or "witcher" in t or "zelda" in t:
        return "accent-gold"
    if "metro" in t or "fallout" in t or "stalker" in t or "s.t.a.l.k.e.r." in t or "doom" in t or "god of war" in t or "hades" in t or "red dead" in t or "rdr" in t:
        return "accent-amber"
    if "watch dogs" in t or "watch_dogs" in t or "deus ex" in t or "death stranding" in t or "spider-man" in t or "batman" in t:
        return "accent-blue"
    if "cyberpunk" in t or "phantom liberty" in t or "neon" in t or "borderlands" in t:
        return "accent-yellow"
    return "primary"


class LibraryService:
    """Coordinates business logic for user library management."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.game_repo = GameRepository(session)
        self.library_repo = LibraryRepository(session)

    async def add_game(self, payload: LibraryEntryCreate) -> LibraryEntryRead:
        """Imports a title from IGDB, triggers artwork caching, and creates library entry."""
        # 1. Check for duplicates
        existing = await self.library_repo.get_by_igdb_id(payload.igdb_id)
        if existing:
            raise DuplicateEntityException(
                message=f"Game with IGDB ID {payload.igdb_id} is already in your library.",
                details={"igdb_id": payload.igdb_id, "library_entry_id": existing.id},
            )

        # 2. Retrieve metadata from IGDB
        details = await igdb_client.get_game_details(payload.igdb_id)
        if not details:
            raise EntityNotFoundException(
                message=f"Game with IGDB ID {payload.igdb_id} was not found on IGDB.",
                details={"igdb_id": payload.igdb_id},
            )

        # 3. Create or update Game record
        game = await self.game_repo.create_or_update_from_igdb(details)

        # 4. Create LibraryEntry
        entry = LibraryEntry(
            game_id=game.id,
            playing_status=payload.playing_status,
            ownership_status=payload.ownership_status,
            platform=payload.platform,
            priority=payload.priority,
            completion_goal=payload.completion_goal,
            progress_pct=payload.progress_pct or 0.0,
            hours_played=payload.hours_played or 0.0,
            personal_rating=payload.personal_rating,
            planned_start_date=payload.planned_start_date,
            target_completion_date=payload.target_completion_date,
            custom_tags=payload.custom_tags or "",
            notes=payload.notes or "",
        )
        await self.library_repo.create_entry(entry)

        # 5. Artwork Acquisition and Local Caching (non-fatal if network/artwork fails)
        try:
            await self._cache_and_assign_artwork(game, details)
        except Exception as exc:
            logger.warning(f"Non-fatal artwork download failure for '{game.title}': {exc}")

        # Commit transaction
        await self.session.commit()

        # Re-fetch populated entry
        saved = await self.library_repo.get_by_id(entry.id)
        return self.format_entry_response(saved)

    async def _cache_and_assign_artwork(self, game: Game, details: Dict[str, Any]) -> None:
        """Retrieves and caches preferred SteamGridDB assets with IGDB fallbacks."""
        title = game.title
        steam_app_id = game.steam_app_id

        # Query SteamGridDB
        sgdb_data = await steamgriddb_client.get_all_artwork(title, steam_app_id)
        if sgdb_data.get("sgdb_id"):
            game.steamgriddb_id = sgdb_data["sgdb_id"]

        # 1. Portrait Cover (2:3)
        cover_remote_url = None
        cover_source = ArtworkSource.STEAMGRIDDB.value
        if sgdb_data.get("grids"):
            cover_remote_url = sgdb_data["grids"][0]["url"]
        elif details.get("cover_url"):
            cover_remote_url = details["cover_url"]
            cover_source = ArtworkSource.IGDB.value

        if cover_remote_url:
            cached = await artwork_cache.download_and_cache(cover_remote_url, category="covers")
            if cached:
                self.session.add(
                    GameArtwork(
                        game_id=game.id,
                        asset_type=AssetType.COVER.value,
                        remote_url=cover_remote_url,
                        local_path=cached["local_path"],
                        width=cached["width"],
                        height=cached["height"],
                        file_size_bytes=cached["file_size_bytes"],
                        mime_type=cached["mime_type"],
                        sha256_hash=cached["sha256_hash"],
                        is_active=True,
                        source=cover_source,
                    )
                )

        # 2. Hero Landscape (16:9)
        hero_remote_url = None
        hero_source = ArtworkSource.STEAMGRIDDB.value
        if sgdb_data.get("heroes"):
            hero_remote_url = sgdb_data["heroes"][0]["url"]
        elif details.get("hero_url"):
            hero_remote_url = details["hero_url"]
            hero_source = ArtworkSource.IGDB.value

        if hero_remote_url:
            cached = await artwork_cache.download_and_cache(hero_remote_url, category="heroes")
            if cached:
                self.session.add(
                    GameArtwork(
                        game_id=game.id,
                        asset_type=AssetType.HERO.value,
                        remote_url=hero_remote_url,
                        local_path=cached["local_path"],
                        width=cached["width"],
                        height=cached["height"],
                        file_size_bytes=cached["file_size_bytes"],
                        mime_type=cached["mime_type"],
                        sha256_hash=cached["sha256_hash"],
                        is_active=True,
                        source=hero_source,
                    )
                )

        # 3. Transparent Logo (PNG)
        if sgdb_data.get("logos"):
            logo_remote_url = sgdb_data["logos"][0]["url"]
            cached = await artwork_cache.download_and_cache(logo_remote_url, category="logos")
            if cached:
                self.session.add(
                    GameArtwork(
                        game_id=game.id,
                        asset_type=AssetType.LOGO.value,
                        remote_url=logo_remote_url,
                        local_path=cached["local_path"],
                        width=cached["width"],
                        height=cached["height"],
                        file_size_bytes=cached["file_size_bytes"],
                        mime_type=cached["mime_type"],
                        sha256_hash=cached["sha256_hash"],
                        is_active=True,
                        source=ArtworkSource.STEAMGRIDDB.value,
                    )
                )

        # 4. IGDB Gameplay Screenshots metadata (lazy remote display, not downloaded eagerly)
        for shot_url in (details.get("screenshots") or [])[:6]:
            if shot_url:
                self.session.add(
                    GameArtwork(
                        game_id=game.id,
                        asset_type=AssetType.SCREENSHOT.value,
                        remote_url=shot_url,
                        local_path="",
                        is_active=True,
                        source=ArtworkSource.IGDB.value,
                    )
                )

        await self.session.flush()

    def format_entry_response(self, entry: LibraryEntry) -> LibraryEntryRead:
        """Formats a LibraryEntry ORM model into the enriched API response schema."""
        cover_url = None
        hero_url = None
        logo_url = None

        category_map = {
            AssetType.COVER.value: "covers",
            AssetType.HERO.value: "heroes",
            AssetType.LOGO.value: "logos",
            AssetType.SCREENSHOT.value: "screenshots",
        }

        if entry.game and entry.game.artworks:
            for art in entry.game.artworks:
                if not art.is_active:
                    continue
                # Serve via local artwork cache endpoint if cached locally
                if art.local_path and art.sha256_hash:
                    category = category_map.get(art.asset_type, "covers")
                    filename = Path(art.local_path).name
                    url = f"/api/v1/artwork/cache/{category}/{filename}"
                else:
                    url = art.remote_url

                if art.asset_type == AssetType.COVER.value and not cover_url:
                    cover_url = url
                elif art.asset_type == AssetType.HERO.value and not hero_url:
                    hero_url = url
                elif art.asset_type == AssetType.LOGO.value and not logo_url:
                    logo_url = url

        # High-definition Steam CDN fallbacks if artwork is missing from database
        steam_app_id = getattr(entry.game, "steam_app_id", None)
        if steam_app_id:
            if not cover_url:
                cover_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{steam_app_id}/library_600x900.jpg"
            if not hero_url:
                hero_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{steam_app_id}/library_hero.jpg"
            if not logo_url:
                logo_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{steam_app_id}/logo.png"

        artwork_bundle = GameArtworkBundle(
            cover_url=cover_url,
            hero_url=hero_url,
            logo_url=logo_url,
        )

        read_schema = LibraryEntryRead.model_validate(entry)
        read_schema.artwork = artwork_bundle
        read_schema.active_accent = resolve_active_accent(entry.game.title if entry.game else "")

        if read_schema.game and read_schema.game.artworks:
            for art_item in read_schema.game.artworks:
                if art_item.local_path:
                    category = category_map.get(art_item.asset_type, "covers")
                    art_item.cached_url = f"/api/v1/artwork/cache/{category}/{Path(art_item.local_path).name}"
                else:
                    art_item.cached_url = art_item.remote_url

        if entry.game and entry.game.raw_metadata:
            try:
                parsed_meta = json.loads(entry.game.raw_metadata)
                if isinstance(parsed_meta, dict):
                    read_schema.game.platforms = parsed_meta.get("platforms", [])
                    read_schema.game.igdb_rating_count = parsed_meta.get("igdb_rating_count")
            except Exception:
                pass

        return read_schema
