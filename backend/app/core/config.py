"""Application configuration and settings management."""
import os
import secrets
import sys
from pathlib import Path
from typing import List, Optional
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def get_default_data_dir() -> Path:
    """Returns the default platform-specific user data directory (%APPDATA%/Checkpoint)."""
    custom = os.getenv("CHECKPOINT_DATA_DIR")
    if custom:
        return Path(custom)
    appdata = os.getenv("APPDATA")
    if appdata:
        return Path(appdata) / "Checkpoint"
    return Path.home() / ".checkpoint"


def get_default_cache_dir() -> Path:
    """Returns the default platform-specific artwork cache directory (%APPDATA%/Checkpoint/artwork_cache)."""
    custom = os.getenv("CHECKPOINT_CACHE_DIR")
    if custom:
        return Path(custom)
    appdata = os.getenv("APPDATA")
    if appdata:
        return Path(appdata) / "Checkpoint" / "artwork_cache"
    return Path.home() / ".checkpoint" / "artwork_cache"


def get_credentials_path() -> Path:
    """Returns the path to stored production API credentials (%APPDATA%/Checkpoint/credentials.json)."""
    custom = os.getenv("CHECKPOINT_DATA_DIR")
    if custom:
        return Path(custom) / "credentials.json"
    appdata = os.getenv("APPDATA")
    if appdata:
        return Path(appdata) / "Checkpoint" / "credentials.json"
    return Path.home() / ".checkpoint" / "credentials.json"


def read_saved_credentials() -> dict:
    """Reads persistent user API credentials (migrating legacy plaintext to DPAPI if needed)."""
    from app.core.dpapi import load_protected_credentials

    return load_protected_credentials(get_credentials_path())


_ENV_FILE = (
    None
    if getattr(sys, "frozen", False)
    else str(Path(__file__).resolve().parent.parent.parent / ".env")
)


class Settings(BaseSettings):
    """Central configuration for CHECKPOINT Gaming Hub."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    APP_NAME: str = "CHECKPOINT Gaming Hub"
    APP_VERSION: str = "1.0.1"
    APP_ENV: str = "development"  # development, testing, production
    HOST: str = "127.0.0.1"
    PORT: int = 8765

    # IGDB & Twitch Credentials
    IGDB_CLIENT_ID: Optional[SecretStr] = None
    IGDB_CLIENT_SECRET: Optional[SecretStr] = None
    TWITCH_CLIENT_ID: Optional[SecretStr] = None
    TWITCH_CLIENT_SECRET: Optional[SecretStr] = None
    
    # SteamGridDB Credentials
    STEAMGRIDDB_API_KEY: Optional[SecretStr] = None

    # Steam Web API Credentials (Phase 6)
    STEAM_WEB_API_KEY: Optional[SecretStr] = None

    # IsThereAnyDeal API Credentials (Phase 6)
    ITAD_API_KEY: Optional[SecretStr] = None

    # Database
    DATABASE_URL: Optional[str] = None

    # Security Handshake Token
    CHECKPOINT_AUTH_TOKEN: Optional[SecretStr] = None

    # CORS Whitelist
    CORS_ORIGINS: List[str] = [
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Directories
    DATA_DIR: Path = Field(default_factory=get_default_data_dir)
    ARTWORK_CACHE_DIR: Path = Field(default_factory=get_default_cache_dir)

    # API Timeouts and limits
    HTTP_TIMEOUT_SECONDS: float = 10.0
    IGDB_REQUESTS_PER_SECOND: float = 4.0
    MAX_ARTWORK_FILE_SIZE_BYTES: int = 20 * 1024 * 1024  # 20MB limit per image

    @field_validator("IGDB_CLIENT_ID", mode="before")
    @classmethod
    def resolve_igdb_client_id(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v
        env_val = os.getenv("IGDB_CLIENT_ID") or os.getenv("TWITCH_CLIENT_ID")
        if env_val:
            return env_val
        return read_saved_credentials().get("igdb_client_id")

    @field_validator("IGDB_CLIENT_SECRET", mode="before")
    @classmethod
    def resolve_igdb_client_secret(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v
        env_val = os.getenv("IGDB_CLIENT_SECRET") or os.getenv("TWITCH_CLIENT_SECRET")
        if env_val:
            return env_val
        return read_saved_credentials().get("igdb_client_secret")

    @field_validator("STEAMGRIDDB_API_KEY", mode="before")
    @classmethod
    def resolve_steamgriddb_api_key(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v
        env_val = os.getenv("STEAMGRIDDB_API_KEY")
        if env_val:
            return env_val
        return read_saved_credentials().get("steamgriddb_api_key")

    @field_validator("STEAM_WEB_API_KEY", mode="before")
    @classmethod
    def resolve_steam_web_api_key(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v
        env_val = os.getenv("STEAM_WEB_API_KEY")
        if env_val:
            return env_val
        return read_saved_credentials().get("steam_web_api_key")

    @field_validator("ITAD_API_KEY", mode="before")
    @classmethod
    def resolve_itad_api_key(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v
        env_val = os.getenv("ITAD_API_KEY")
        if env_val:
            return env_val
        return read_saved_credentials().get("itad_api_key")

    def update_credentials(
        self,
        igdb_id: Optional[str] = None,
        igdb_secret: Optional[str] = None,
        sgdb_key: Optional[str] = None,
        steam_api_key: Optional[str] = None,
        itad_key: Optional[str] = None,
    ) -> None:
        """Encrypts and persists user API credentials via Windows DPAPI in %APPDATA%/Checkpoint/credentials.json."""
        from app.core.dpapi import save_protected_credentials

        creds = read_saved_credentials()
        if igdb_id is not None:
            val = igdb_id.strip() if igdb_id else None
            creds["igdb_client_id"] = val
            self.IGDB_CLIENT_ID = SecretStr(val) if val else None
        if igdb_secret is not None:
            val = igdb_secret.strip() if igdb_secret else None
            creds["igdb_client_secret"] = val
            self.IGDB_CLIENT_SECRET = SecretStr(val) if val else None
        if sgdb_key is not None:
            val = sgdb_key.strip() if sgdb_key else None
            creds["steamgriddb_api_key"] = val
            self.STEAMGRIDDB_API_KEY = SecretStr(val) if val else None
        if steam_api_key is not None:
            val = steam_api_key.strip() if steam_api_key else None
            creds["steam_web_api_key"] = val
            self.STEAM_WEB_API_KEY = SecretStr(val) if val else None
        if itad_key is not None:
            val = itad_key.strip() if itad_key else None
            creds["itad_api_key"] = val
            self.ITAD_API_KEY = SecretStr(val) if val else None

        save_protected_credentials(get_credentials_path(), creds)

    def get_steam_web_api_key(self) -> Optional[str]:
        if self.STEAM_WEB_API_KEY and self.STEAM_WEB_API_KEY.get_secret_value():
            return self.STEAM_WEB_API_KEY.get_secret_value()
        return None

    def get_itad_api_key(self) -> Optional[str]:
        if self.ITAD_API_KEY and self.ITAD_API_KEY.get_secret_value():
            return self.ITAD_API_KEY.get_secret_value()
        return None

    def get_igdb_client_id(self) -> Optional[str]:
        if self.IGDB_CLIENT_ID and self.IGDB_CLIENT_ID.get_secret_value():
            return self.IGDB_CLIENT_ID.get_secret_value()
        if self.TWITCH_CLIENT_ID and self.TWITCH_CLIENT_ID.get_secret_value():
            return self.TWITCH_CLIENT_ID.get_secret_value()
        return None

    def get_igdb_client_secret(self) -> Optional[str]:
        if self.IGDB_CLIENT_SECRET and self.IGDB_CLIENT_SECRET.get_secret_value():
            return self.IGDB_CLIENT_SECRET.get_secret_value()
        if self.TWITCH_CLIENT_SECRET and self.TWITCH_CLIENT_SECRET.get_secret_value():
            return self.TWITCH_CLIENT_SECRET.get_secret_value()
        return None

    def get_database_url(self) -> str:
        """Resolves async SQLite database URL."""
        if self.DATABASE_URL:
            # Ensure aiosqlite prefix for async SQLAlchemy
            if self.DATABASE_URL.startswith("sqlite:///"):
                return self.DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///")
            return self.DATABASE_URL
        
        # Production / Default AppData path
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        db_file = self.DATA_DIR / "checkpoint.db"
        return f"sqlite+aiosqlite:///{db_file.as_posix()}"

    def get_auth_token_str(self) -> str:
        """Returns the auth token string or generates a secure dev token."""
        if self.CHECKPOINT_AUTH_TOKEN and self.CHECKPOINT_AUTH_TOKEN.get_secret_value():
            return self.CHECKPOINT_AUTH_TOKEN.get_secret_value()
        # In dev mode, provide fallback if not configured
        if self.APP_ENV == "development":
            return "dev_secret_token_change_in_prod"
        # In prod, generate ephemeral token if none provided
        return secrets.token_urlsafe(32)

    def ensure_directories(self) -> None:
        """Creates required application data directories."""
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.ARTWORK_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        for sub in ["covers", "heroes", "logos", "screenshots", "animated", "thumbnails"]:
            (self.ARTWORK_CACHE_DIR / sub).mkdir(parents=True, exist_ok=True)


settings = Settings()
