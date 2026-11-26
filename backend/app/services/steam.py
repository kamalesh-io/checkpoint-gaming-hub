"""Steam Web API client and account integration service."""
import datetime
import re
from typing import Any, Dict, Optional, Tuple
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.steam import SteamAccount
from app.schemas.steam import SteamAccountStatus, SteamTestConnectionResponse


STEAM_API_BASE = "https://api.steampowered.com"


class SteamService:
    """Handles Steam Web API communications and persistent account state."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def extract_steam_id_64(input_str: str) -> Optional[str]:
        """Extracts a 17-digit SteamID64 from a raw string or Steam Community URL."""
        cleaned = input_str.strip()
        # Direct 17-digit numeric string
        if re.fullmatch(r"\d{17}", cleaned):
            return cleaned

        # /profiles/7656119... URL match
        match = re.search(r"steamcommunity\.com/profiles/(\d{17})", cleaned)
        if match:
            return match.group(1)

        return None

    @staticmethod
    async def resolve_vanity_url(vanity_input: str, api_key: str) -> Optional[str]:
        """Resolves custom Steam profile vanity name to a SteamID64."""
        # Clean URL if passed as full steamcommunity.com/id/name
        match = re.search(r"steamcommunity\.com/id/([^/?#]+)", vanity_input.strip())
        vanity_name = match.group(1) if match else vanity_input.strip()

        url = f"{STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/"
        params = {"key": api_key, "vanityurl": vanity_name}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    response = data.get("response", {})
                    if response.get("success") == 1 and response.get("steamid"):
                        return str(response["steamid"])
        except Exception as exc:
            logger.warning(f"Failed to resolve Steam vanity URL '{vanity_input}': {exc}")
        return None

    async def resolve_identifier(self, identifier: str, api_key: Optional[str]) -> Optional[str]:
        """Attempts to resolve any Steam input (ID, URL, or custom vanity) into a SteamID64."""
        steam_id = self.extract_steam_id_64(identifier)
        if steam_id:
            return steam_id
        if api_key:
            return await self.resolve_vanity_url(identifier, api_key)
        return None

    async def get_player_summary(self, steam_id_64: str, api_key: str) -> Tuple[bool, Dict[str, Any], str]:
        """Queries ISteamUser/GetPlayerSummaries/v0002 for basic public profile info."""
        url = f"{STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/"
        params = {"key": api_key, "steamids": steam_id_64}
        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                res = await client.get(url, params=params)
                if res.status_code == 403 or res.status_code == 401:
                    return False, {}, "Invalid Steam Web API Key."
                if res.status_code == 429:
                    return False, {}, "Steam Web API rate limit exceeded. Please try again later."
                if res.status_code != 200:
                    return False, {}, f"Steam Web API returned HTTP {res.status_code}."

                data = res.json()
                players = data.get("response", {}).get("players", [])
                if not players:
                    return False, {}, "Steam account not found."
                return True, players[0], "Success"
        except httpx.TimeoutException:
            return False, {}, "Connection to Steam timed out."
        except Exception as exc:
            logger.error(f"Error fetching Steam player summary: {exc}")
            return False, {}, f"Steam connection failed: {type(exc).__name__}"

    async def test_connection(
        self, identifier: str, api_key_override: Optional[str] = None
    ) -> SteamTestConnectionResponse:
        """Validates credentials and profile accessibility without altering database state."""
        api_key = api_key_override or settings.get_steam_web_api_key()
        if not api_key:
            return SteamTestConnectionResponse(
                success=False,
                message="Steam Web API Key is required. Please provide a key.",
            )

        steam_id = await self.resolve_identifier(identifier, api_key)
        if not steam_id:
            return SteamTestConnectionResponse(
                success=False,
                message="Invalid SteamID64 or unresolvable Steam profile URL.",
            )

        ok, player, msg = await self.get_player_summary(steam_id, api_key)
        if not ok:
            return SteamTestConnectionResponse(success=False, message=msg)

        visibility = player.get("communityvisibilitystate", 1)
        is_private = visibility != 3
        warning = None
        if is_private:
            warning = (
                "This Steam profile is currently Private or Friends-Only. "
                "Steam games, playtime, and achievements will not be accessible via API "
                "unless Game Details privacy is set to Public in Steam Privacy Settings."
            )

        return SteamTestConnectionResponse(
            success=True,
            persona_name=player.get("personaname"),
            avatar_url=player.get("avatarfull") or player.get("avatarmedium"),
            profile_url=player.get("profileurl"),
            is_private=is_private,
            message=f"Connected as {player.get('personaname')}",
            privacy_warning=warning,
        )

    async def connect_account(
        self,
        identifier: str,
        api_key_override: Optional[str] = None,
        auto_sync: bool = False,
        sync_interval: int = 24,
    ) -> SteamAccountStatus:
        """Connects or updates Steam account in database and updates DPAPI credential store."""
        api_key = api_key_override or settings.get_steam_web_api_key()
        if not api_key:
            raise ValueError("Steam Web API Key is required.")

        steam_id = await self.resolve_identifier(identifier, api_key)
        if not steam_id:
            raise ValueError("Invalid SteamID64 or Steam profile URL.")

        ok, player, msg = await self.get_player_summary(steam_id, api_key)
        if not ok:
            raise ValueError(msg)

        # Save API key in DPAPI if an override was supplied
        if api_key_override:
            settings.update_credentials(steam_api_key=api_key_override)

        visibility = player.get("communityvisibilitystate", 1)
        is_private = visibility != 3

        result = await self.session.execute(
            select(SteamAccount).where(SteamAccount.steam_id_64 == steam_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            account = SteamAccount(steam_id_64=steam_id)
            self.session.add(account)

        account.persona_name = player.get("personaname")
        account.avatar_url = player.get("avatarfull") or player.get("avatarmedium")
        account.profile_url = player.get("profileurl")
        account.community_visibility_state = visibility
        account.auto_sync_enabled = auto_sync
        account.sync_interval_hours = sync_interval
        account.is_connected = True

        await self.session.commit()
        await self.session.refresh(account)

        warning = (
            "Profile is private. Set Game Details privacy to Public in Steam for full library sync."
            if is_private
            else None
        )

        return SteamAccountStatus(
            is_connected=True,
            steam_id_64=account.steam_id_64,
            persona_name=account.persona_name,
            avatar_url=account.avatar_url,
            profile_url=account.profile_url,
            is_private=is_private,
            auto_sync_enabled=account.auto_sync_enabled,
            sync_interval_hours=account.sync_interval_hours,
            last_synced_at=account.last_synced_at,
            has_api_key=bool(settings.get_steam_web_api_key()),
            privacy_warning=warning,
        )

    async def get_account_status(self) -> SteamAccountStatus:
        """Retrieves active Steam account connection status."""
        result = await self.session.execute(
            select(SteamAccount).where(SteamAccount.is_connected == True)  # noqa: E712
        )
        account = result.scalar_one_or_none()
        if not account:
            return SteamAccountStatus(
                is_connected=False,
                has_api_key=bool(settings.get_steam_web_api_key()),
            )

        is_private = account.community_visibility_state != 3
        warning = (
            "Profile is private. Set Game Details privacy to Public in Steam for full library sync."
            if is_private
            else None
        )

        return SteamAccountStatus(
            is_connected=True,
            steam_id_64=account.steam_id_64,
            persona_name=account.persona_name,
            avatar_url=account.avatar_url,
            profile_url=account.profile_url,
            is_private=is_private,
            auto_sync_enabled=account.auto_sync_enabled,
            sync_interval_hours=account.sync_interval_hours,
            last_synced_at=account.last_synced_at,
            has_api_key=bool(settings.get_steam_web_api_key()),
            privacy_warning=warning,
        )

    async def disconnect_account(self) -> None:
        """Disconnects linked Steam account without deleting personal game library or progress."""
        result = await self.session.execute(
            select(SteamAccount).where(SteamAccount.is_connected == True)  # noqa: E712
        )
        account = result.scalar_one_or_none()
        if account:
            account.is_connected = False
            await self.session.commit()
