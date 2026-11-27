"""Twitch OAuth token management for IGDB v4 API."""
import asyncio
import time
from typing import Optional
import httpx
from app.core.config import settings
from app.core.exceptions import AuthenticationException, ExternalApiException
from app.core.logging import logger
from app.services.error_classifier import classify_external_network_error

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"


class TwitchAuthManager:
    """Manages Twitch OAuth2 Client Credentials lifecycle with automatic renewal."""

    def __init__(self):
        self._access_token: Optional[str] = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    def invalidate_token(self) -> None:
        """Clears any cached OAuth token so the next request re-authenticates."""
        self._access_token = None
        self._expires_at = 0.0

    @property
    def is_token_valid(self) -> bool:
        """Verifies if the cached token has more than 5 minutes of validity remaining."""
        return bool(self._access_token and time.time() < (self._expires_at - 300))

    async def get_access_token(self, force_refresh: bool = False) -> str:
        """Returns a valid Twitch OAuth token, refreshing if necessary."""
        if not force_refresh and self.is_token_valid:
            return self._access_token

        async with self._lock:
            # Double-check inside lock to prevent stampede
            if not force_refresh and self.is_token_valid:
                return self._access_token

            client_id = settings.get_igdb_client_id()
            client_secret = settings.get_igdb_client_secret()

            if not client_id or not client_secret:
                logger.error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET in configuration.")
                raise AuthenticationException(
                    message="IGDB credentials are not configured.",
                    details={"error": "MISSING_CREDENTIALS"},
                )

            logger.info("Requesting new Twitch OAuth2 access token for IGDB API...")
            try:
                async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        TWITCH_TOKEN_URL,
                        params={
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "grant_type": "client_credentials",
                        },
                    )

                    if response.status_code != 200:
                        logger.error(f"Twitch OAuth token request failed: {response.status_code}")
                        raise AuthenticationException(
                            message=f"Twitch OAuth failed with status {response.status_code}",
                            details={"status_code": response.status_code},
                        )

                    data = response.json()
                    self._access_token = data["access_token"]
                    expires_in = data.get("expires_in", 3600)
                    self._expires_at = time.time() + expires_in
                    logger.info(f"Twitch OAuth token successfully acquired (valid for {expires_in} seconds).")
                    return self._access_token

            except httpx.RequestError as exc:
                logger.error(f"Network error during Twitch token request: {exc}")
                raise classify_external_network_error(exc, service="Twitch Authentication")


twitch_auth_manager = TwitchAuthManager()
