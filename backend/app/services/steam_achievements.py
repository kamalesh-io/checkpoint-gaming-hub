"""Steam Achievements tracking, synchronization, and normalization service."""
import datetime
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.achievement import SteamAchievement
from app.models.game import Game
from app.models.steam import SteamAccount
from app.schemas.steam import GameAchievementsResponse, SteamAchievementItem
from app.services.steam import STEAM_API_BASE


class SteamAchievementService:
    """Synchronizes and queries normalized Steam achievements for library games."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_achievements(
        self, game_id: str, force_refresh: bool = False
    ) -> GameAchievementsResponse:
        """Retrieves cached achievements for a game, or synchronizes from Steam Web API."""
        # 1. Look up game and verify it has a Steam App ID
        game_res = await self.session.execute(select(Game).where(Game.id == game_id))
        game = game_res.scalar_one_or_none()
        if not game or not game.steam_app_id:
            return GameAchievementsResponse(
                game_id=game_id,
                total_count=0,
                unlocked_count=0,
                completion_pct=0.0,
                is_available=False,
                message="Game is not linked to a Steam App ID.",
                achievements=[],
            )

        # 2. Check local database cached achievements
        cached_res = await self.session.execute(
            select(SteamAchievement)
            .where(SteamAchievement.game_id == game_id)
            .order_by(SteamAchievement.unlocked.desc(), SteamAchievement.unlock_time.desc())
        )
        cached_achievements = cached_res.scalars().all()

        if cached_achievements and not force_refresh:
            return self._build_response(game_id, game.steam_app_id, cached_achievements)

        # 3. Synchronize from Steam Web API
        sync_ok, message = await self.sync_achievements_from_steam(game)
        if not sync_ok and cached_achievements:
            # Fallback to cached achievements with a warning
            resp = self._build_response(game_id, game.steam_app_id, cached_achievements)
            resp.message = f"Live sync failed ({message}); displaying cached achievements."
            return resp

        # Re-query newly saved achievements
        fresh_res = await self.session.execute(
            select(SteamAchievement)
            .where(SteamAchievement.game_id == game_id)
            .order_by(SteamAchievement.unlocked.desc(), SteamAchievement.unlock_time.desc())
        )
        refreshed = fresh_res.scalars().all()
        return self._build_response(game_id, game.steam_app_id, refreshed, msg=message)

    async def sync_achievements_from_steam(self, game: Game) -> tuple[bool, str]:
        """Fetches achievement schema, user unlocks, and global unlock rates from Steam."""
        api_key = settings.get_steam_web_api_key()
        if not api_key:
            return False, "Steam Web API key is not configured."

        # Fetch connected account
        acct_res = await self.session.execute(
            select(SteamAccount).where(SteamAccount.is_connected == True)  # noqa: E712
        )
        account = acct_res.scalar_one_or_none()
        if not account:
            return False, "No active Steam account connected."

        app_id = game.steam_app_id
        steam_id = account.steam_id_64

        schema_achievements: Dict[str, Dict[str, Any]] = {}
        player_achievements: Dict[str, Dict[str, Any]] = {}
        global_percentages: Dict[str, float] = {}

        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
            # A. GetSchemaForGame (names, descriptions, icons, hidden state)
            schema_url = f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v0002/"
            try:
                res = await client.get(
                    schema_url, params={"key": api_key, "appid": app_id, "l": "english"}
                )
                if res.status_code == 200:
                    raw_schema = res.json().get("game", {}).get("availableGameStats", {})
                    for a in raw_schema.get("achievements", []):
                        if a.get("name"):
                            schema_achievements[a["name"]] = a
            except Exception as exc:
                logger.warning(f"Failed to fetch schema for app {app_id}: {exc}")

            if not schema_achievements:
                return False, "This game has no Steam achievements or schema is restricted."

            # B. GetPlayerAchievements (unlocked state and timestamps)
            player_url = f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/"
            try:
                res = await client.get(
                    player_url,
                    params={"key": api_key, "appid": app_id, "steamid": steam_id, "l": "english"},
                )
                if res.status_code == 200:
                    stats = res.json().get("playerstats", {})
                    if stats.get("success"):
                        for a in stats.get("achievements", []):
                            if a.get("apiname"):
                                player_achievements[a["apiname"]] = a
                elif res.status_code == 403:
                    return False, "Profile is private. Cannot read player achievements."
            except Exception as exc:
                logger.warning(f"Failed to fetch player achievements for app {app_id}: {exc}")

            # C. GetGlobalAchievementPercentagesForApp (global rarity)
            global_url = (
                f"{STEAM_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/"
            )
            try:
                res = await client.get(global_url, params={"gameid": app_id})
                if res.status_code == 200:
                    for a in res.json().get("achievementpercentages", {}).get("achievements", []):
                        if a.get("name"):
                            global_percentages[a["name"]] = round(float(a.get("percent", 0.0)), 1)
            except Exception as exc:
                logger.warning(f"Failed to fetch global percentages for app {app_id}: {exc}")

        # Persist / Upsert into steam_achievements table
        now = datetime.datetime.now(datetime.timezone.utc)
        existing_res = await self.session.execute(
            select(SteamAchievement).where(SteamAchievement.game_id == game.id)
        )
        existing_map = {a.api_name: a for a in existing_res.scalars().all()}

        for api_name, s_data in schema_achievements.items():
            p_data = player_achievements.get(api_name, {})
            unlocked = bool(p_data.get("achieved") == 1)
            unlock_epoch = p_data.get("unlocktime")
            unlock_time = (
                datetime.datetime.fromtimestamp(unlock_epoch, datetime.timezone.utc)
                if unlock_epoch and unlock_epoch > 0
                else None
            )
            global_pct = global_percentages.get(api_name)

            if api_name in existing_map:
                record = existing_map[api_name]
                record.display_name = s_data.get("displayName", api_name)
                record.description = s_data.get("description")
                record.icon_url = s_data.get("icon")
                record.icon_gray_url = s_data.get("icongray")
                record.is_hidden = bool(s_data.get("hidden", 0) == 1)
                record.unlocked = unlocked
                record.unlock_time = unlock_time
                record.global_percentage = global_pct
                record.last_synced_at = now
            else:
                record = SteamAchievement(
                    game_id=game.id,
                    api_name=api_name,
                    display_name=s_data.get("displayName", api_name),
                    description=s_data.get("description"),
                    icon_url=s_data.get("icon"),
                    icon_gray_url=s_data.get("icongray"),
                    is_hidden=bool(s_data.get("hidden", 0) == 1),
                    unlocked=unlocked,
                    unlock_time=unlock_time,
                    global_percentage=global_pct,
                    last_synced_at=now,
                )
                self.session.add(record)

        await self.session.commit()
        return True, "Achievements synchronized successfully."

    def _build_response(
        self,
        game_id: str,
        steam_app_id: Optional[int],
        achievements: List[SteamAchievement],
        msg: Optional[str] = None,
    ) -> GameAchievementsResponse:
        total = len(achievements)
        unlocked = sum(1 for a in achievements if a.unlocked)
        pct = round((unlocked / total * 100.0), 1) if total > 0 else 0.0
        last_sync = max((a.last_synced_at for a in achievements if a.last_synced_at), default=None)

        items = [
            SteamAchievementItem(
                id=a.id,
                api_name=a.api_name,
                display_name=a.display_name,
                description=a.description,
                icon_url=a.icon_url,
                icon_gray_url=a.icon_gray_url,
                is_hidden=a.is_hidden,
                unlocked=a.unlocked,
                unlock_time=a.unlock_time,
                global_percentage=a.global_percentage,
            )
            for a in achievements
        ]

        return GameAchievementsResponse(
            game_id=game_id,
            steam_app_id=steam_app_id,
            total_count=total,
            unlocked_count=unlocked,
            completion_pct=pct,
            completion_suggestion=(unlocked == total and total > 0),
            last_synced_at=last_sync,
            is_available=True,
            message=msg,
            achievements=items,
        )
