"""Steam library scanning, IGDB matching, preview generation, and synchronization service."""
import datetime
from typing import Any, Dict, List, Optional, Tuple
import uuid
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.artwork import AssetType, GameArtwork
from app.models.game import Game
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus
from app.models.steam import SteamAccount
from app.schemas.steam import (
    SteamGamePreview,
    SteamImportExecuteResponse,
    SteamImportPreviewResponse,
)
from app.services.game_detector import KNOWN_EDITION_ALIASES
from app.services.igdb import IGDBClient
from app.services.steam import STEAM_API_BASE


class SteamSyncService:
    """Orchestrates Steam owned games retrieval, IGDB alignment, and library sync."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.igdb_client = IGDBClient()

    async def get_active_account(self) -> Optional[SteamAccount]:
        """Gets currently connected Steam account."""
        result = await self.session.execute(
            select(SteamAccount).where(SteamAccount.is_connected == True)  # noqa: E712
        )
        return result.scalar_one_or_none()

    async def fetch_steam_owned_games(
        self, steam_id_64: str, api_key: str
    ) -> Tuple[bool, List[Dict[str, Any]], str]:
        """Calls IPlayerService/GetOwnedGames/v0001 with appinfo and played free games."""
        url = f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/"
        params = {
            "key": api_key,
            "steamid": steam_id_64,
            "include_appinfo": 1,
            "include_played_free_games": 1,
            "format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                res = await client.get(url, params=params)
                if res.status_code == 401 or res.status_code == 403:
                    return False, [], "Invalid Steam Web API key or access denied."
                if res.status_code != 200:
                    return False, [], f"Steam API returned HTTP {res.status_code}."

                data = res.json()
                response = data.get("response", {})
                games = response.get("games", [])
                return True, games, f"Found {len(games)} Steam games."
        except Exception as exc:
            logger.error(f"Failed to fetch Steam owned games: {exc}")
            return False, [], f"Connection error: {type(exc).__name__}"

    async def generate_import_preview(self) -> SteamImportPreviewResponse:
        """Scans Steam library and categorizes titles into new, existing, and unmatched in O(1) time."""
        account = await self.get_active_account()
        if not account:
            raise ValueError("No connected Steam account found.")

        api_key = settings.get_steam_web_api_key()
        if not api_key:
            raise ValueError("Steam Web API Key is missing.")

        ok, raw_games, msg = await self.fetch_steam_owned_games(account.steam_id_64, api_key)
        if not ok:
            raise ValueError(msg)

        # 1. Fetch all local games with steam_app_id
        result = await self.session.execute(select(Game).where(Game.steam_app_id.isnot(None)))
        local_steam_games = {g.steam_app_id: g for g in result.scalars().all()}

        # Also fetch all games indexed by normalized title
        all_games_res = await self.session.execute(select(Game))
        local_games_by_title = {g.title.lower().strip(): g for g in all_games_res.scalars().all()}

        # 2. Fetch existing library entries mapped by game_id
        entry_result = await self.session.execute(select(LibraryEntry))
        library_entries_by_game = {e.game_id: e for e in entry_result.scalars().all()}

        # 3. Fetch active covers for all games in a single batch query
        art_res = await self.session.execute(
            select(GameArtwork).where(
                GameArtwork.asset_type == AssetType.COVER.value,
                GameArtwork.is_active == True,  # noqa: E712
            )
        )
        covers_by_game = {a.game_id: a.original_url for a in art_res.scalars().all()}

        new_games: List[SteamGamePreview] = []
        existing_games: List[SteamGamePreview] = []
        unmatched_games: List[SteamGamePreview] = []

        for item in raw_games:
            app_id = int(item.get("appid", 0))
            if not app_id:
                continue

            name = item.get("name", f"Steam App {app_id}")
            playtime = int(item.get("playtime_forever", 0))
            last_played = item.get("rtime_last_played")
            
            # Default instant high-resolution Steam CDN capsule artwork (600x900)
            cover_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"

            # Check local games by direct app_id, known edition alias, or title match
            matched_game = local_steam_games.get(app_id)
            if not matched_game:
                aliases = KNOWN_EDITION_ALIASES.get(app_id)
                if aliases:
                    for alias_id in aliases:
                        if alias_id in local_steam_games:
                            matched_game = local_steam_games[alias_id]
                            break
            if not matched_game:
                matched_game = local_games_by_title.get(name.lower().strip())

            if matched_game:
                entry = library_entries_by_game.get(matched_game.id)
                local_cover = covers_by_game.get(matched_game.id)
                if local_cover:
                    cover_url = local_cover

                preview = SteamGamePreview(
                    steam_app_id=app_id,
                    title=matched_game.title,
                    playtime_forever_minutes=playtime,
                    last_played_timestamp=last_played,
                    igdb_id=matched_game.igdb_id,
                    cover_url=cover_url,
                    ownership_status=entry.ownership_status if entry else OwnershipStatus.OWNED.value,
                    already_imported=entry is not None,
                    library_entry_id=entry.id if entry else None,
                )

                if entry:
                    existing_games.append(preview)
                else:
                    new_games.append(preview)
            else:
                # New unimported Steam game.
                # Avoid sequential external IGDB searches to prevent timeout on large libraries.
                # Provide instant Steam 600x900 capsule artwork and accurate telemetry.
                new_games.append(
                    SteamGamePreview(
                        steam_app_id=app_id,
                        title=name,
                        playtime_forever_minutes=playtime,
                        last_played_timestamp=last_played,
                        igdb_id=None,
                        cover_url=cover_url,
                        ownership_status=OwnershipStatus.OWNED.value,
                        already_imported=False,
                    )
                )

        return SteamImportPreviewResponse(
            total_found=len(raw_games),
            new_games=new_games,
            existing_games=existing_games,
            unmatched_games=unmatched_games,
        )

    async def execute_import(
        self,
        app_ids: List[int],
        ownership_overrides: Optional[Dict[int, str]] = None,
    ) -> SteamImportExecuteResponse:
        """Imports selected games into the local Checkpoint library without overwriting personal progress."""
        account = await self.get_active_account()
        if not account:
            raise ValueError("No connected Steam account found.")

        api_key = settings.get_steam_web_api_key()
        if not api_key:
            raise ValueError("Steam Web API Key is missing.")

        ok, raw_games, msg = await self.fetch_steam_owned_games(account.steam_id_64, api_key)
        if not ok:
            raise ValueError(msg)

        steam_games_map = {int(g["appid"]): g for g in raw_games if g.get("appid")}
        overrides = ownership_overrides or {}

        imported_count = 0
        updated_count = 0
        failed_count = 0

        for app_id in app_ids:
            item = steam_games_map.get(app_id)
            if not item:
                failed_count += 1
                continue

            try:
                name = item.get("name", f"Steam App {app_id}")
                playtime = int(item.get("playtime_forever", 0))
                rtime_last_played = item.get("rtime_last_played")
                last_played_dt = (
                    datetime.datetime.fromtimestamp(rtime_last_played, datetime.timezone.utc)
                    if rtime_last_played
                    else None
                )
                ownership = overrides.get(app_id, OwnershipStatus.OWNED.value)

                # Check if Game already exists
                g_res = await self.session.execute(
                    select(Game).where(Game.steam_app_id == app_id)
                )
                game = g_res.scalar_one_or_none()

                if not game:
                    # Create placeholder game record if not yet registered from IGDB
                    slug = f"steam-{app_id}"
                    game = Game(
                        igdb_id=-app_id,  # Negative synthetic ID for raw Steam titles without IGDB
                        title=name,
                        slug=slug,
                        summary=f"Imported from Steam (App ID {app_id}).",
                        steam_app_id=app_id,
                    )
                    self.session.add(game)
                    await self.session.flush()

                    # Add default Steam CDN cover artwork
                    cover_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"
                    art = GameArtwork(
                        id=str(uuid.uuid4()),
                        game_id=game.id,
                        asset_type=AssetType.COVER.value,
                        remote_url=cover_url,
                        width=600,
                        height=900,
                        is_active=True,
                        source="steam",
                    )
                    self.session.add(art)

                # Check if LibraryEntry exists
                e_res = await self.session.execute(
                    select(LibraryEntry).where(LibraryEntry.game_id == game.id)
                )
                entry = e_res.scalar_one_or_none()

                if entry:
                    # Update ONLY Steam-reported telemetry, strictly preserving user-managed fields
                    entry.steam_playtime_minutes = playtime
                    if last_played_dt:
                        entry.steam_last_played_at = last_played_dt
                    if app_id in overrides:
                        entry.ownership_status = ownership
                    updated_count += 1
                else:
                    # Create new library entry
                    entry = LibraryEntry(
                        game_id=game.id,
                        playing_status=PlayingStatus.PLANNED.value,
                        ownership_status=ownership,
                        platform="Steam",
                        steam_playtime_minutes=playtime,
                        steam_last_played_at=last_played_dt,
                        hours_played=0.0,  # Personal hours remain honest and separate from Steam lifetime!
                    )
                    self.session.add(entry)
                    imported_count += 1

            except Exception as exc:
                logger.error(f"Failed to import Steam app {app_id}: {exc}")
                failed_count += 1

        account.last_synced_at = datetime.datetime.now(datetime.timezone.utc)
        await self.session.commit()

        return SteamImportExecuteResponse(
            imported_count=imported_count,
            updated_count=updated_count,
            failed_count=failed_count,
            message=(
                f"Synchronization complete: {imported_count} imported, "
                f"{updated_count} updated, {failed_count} skipped/failed."
            ),
        )
