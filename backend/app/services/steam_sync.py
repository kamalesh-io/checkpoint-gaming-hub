"""Steam library scanning, IGDB matching, preview generation, and synchronization service."""
import datetime
from typing import Any, Dict, List, Optional, Tuple
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
        """Scans Steam library and categorizes titles into new, existing, and unmatched."""
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

        # 2. Fetch existing library entries mapped by game_id
        entry_result = await self.session.execute(select(LibraryEntry))
        library_entries_by_game = {e.game_id: e for e in entry_result.scalars().all()}

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
            cover_url = None

            # Case A: Already in Checkpoint database
            if app_id in local_steam_games:
                game = local_steam_games[app_id]
                entry = library_entries_by_game.get(game.id)

                # Find active cover artwork if available
                art_res = await self.session.execute(
                    select(GameArtwork).where(
                        GameArtwork.game_id == game.id,
                        GameArtwork.asset_type == AssetType.COVER.value,
                        GameArtwork.is_active == True,  # noqa: E712
                    )
                )
                cover_art = art_res.scalar_one_or_none()
                if cover_art:
                    cover_url = cover_art.original_url

                preview = SteamGamePreview(
                    steam_app_id=app_id,
                    title=game.title,
                    playtime_forever_minutes=playtime,
                    last_played_timestamp=last_played,
                    igdb_id=game.igdb_id,
                    cover_url=cover_url,
                    ownership_status=entry.ownership_status if entry else OwnershipStatus.OWNED.value,
                    already_imported=entry is not None,
                    library_entry_id=entry.id if entry else None,
                )

                if entry:
                    existing_games.append(preview)
                else:
                    new_games.append(preview)
                continue

            # Case B: Not in local DB, attempt IGDB match by Steam App ID
            igdb_matched = None
            try:
                if settings.get_igdb_client_id() and settings.get_igdb_client_secret():
                    candidates = await self.igdb_client.search_games(name, limit=5)
                    # Look for exact or high-confidence match with matching steam_app_id
                    for cand in candidates:
                        if cand.steam_app_id == app_id:
                            igdb_matched = cand
                            break
                    if not igdb_matched and candidates:
                        # Fallback to top candidate if name is near identical
                        cand = candidates[0]
                        if cand.title.lower().strip() == name.lower().strip():
                            igdb_matched = cand
            except Exception as exc:
                logger.warning(f"IGDB search for Steam App {app_id} ('{name}') encountered: {exc}")

            if igdb_matched:
                new_games.append(
                    SteamGamePreview(
                        steam_app_id=app_id,
                        title=igdb_matched.title,
                        playtime_forever_minutes=playtime,
                        last_played_timestamp=last_played,
                        igdb_id=igdb_matched.igdb_id,
                        cover_url=igdb_matched.cover_url,
                        ownership_status=OwnershipStatus.OWNED.value,
                        already_imported=False,
                    )
                )
            else:
                # Icon URL fallback from Steam CDN
                icon_hash = item.get("img_icon_url")
                fallback_cover = (
                    f"https://media.steampowered.com/steamcommunity/public/images/apps/{app_id}/{icon_hash}.jpg"
                    if icon_hash
                    else None
                )
                unmatched_games.append(
                    SteamGamePreview(
                        steam_app_id=app_id,
                        title=name,
                        playtime_forever_minutes=playtime,
                        last_played_timestamp=last_played,
                        cover_url=fallback_cover,
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
