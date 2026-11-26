"""Pydantic schemas for Steam Account, Library Sync, Achievements, Launcher, and Price Tracking."""
import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SteamConnectRequest(BaseModel):
    """Request to connect a Steam account."""
    steam_id_64: str = Field(..., description="17-digit SteamID64 or Steam Community URL")
    api_key: Optional[str] = Field(None, description="Optional Steam Web API Key override")
    auto_sync_enabled: bool = Field(False, description="Enable background sync")
    sync_interval_hours: int = Field(24, ge=1, le=168, description="Sync frequency in hours")


class SteamTestConnectionRequest(BaseModel):
    """Request to test Steam connection before connecting."""
    steam_id_64: str = Field(..., description="17-digit SteamID64 or Steam Community URL")
    api_key: Optional[str] = Field(None, description="Optional Steam Web API Key override")


class SteamTestConnectionResponse(BaseModel):
    """Response from Steam connection test."""
    success: bool
    persona_name: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None
    is_private: bool = False
    message: str
    privacy_warning: Optional[str] = None


class SteamAccountStatus(BaseModel):
    """Current connection state and profile metadata of linked Steam account."""
    is_connected: bool
    steam_id_64: Optional[str] = None
    persona_name: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None
    is_private: bool = False
    auto_sync_enabled: bool = False
    sync_interval_hours: int = 24
    last_synced_at: Optional[datetime.datetime] = None
    has_api_key: bool = False
    privacy_warning: Optional[str] = None


class SteamGamePreview(BaseModel):
    """Single game candidate identified during Steam library scan."""
    steam_app_id: int
    title: str
    playtime_forever_minutes: int = 0
    last_played_timestamp: Optional[int] = None
    igdb_id: Optional[int] = None
    cover_url: Optional[str] = None
    ownership_status: str = "Owned"
    already_imported: bool = False
    library_entry_id: Optional[str] = None


class SteamImportPreviewResponse(BaseModel):
    """Full preview of a Steam library import scan before user confirmation."""
    total_found: int
    new_games: List[SteamGamePreview]
    existing_games: List[SteamGamePreview]
    unmatched_games: List[SteamGamePreview]


class SteamImportExecuteRequest(BaseModel):
    """Payload to execute confirmed Steam library import."""
    app_ids: List[int] = Field(..., description="Selected Steam App IDs to import")
    ownership_status_overrides: Optional[Dict[int, str]] = Field(
        default=None, description="Optional map of App ID -> OwnershipStatus (e.g. 'Family Shared')"
    )


class SteamImportExecuteResponse(BaseModel):
    """Summary of completed Steam library import."""
    imported_count: int
    updated_count: int
    failed_count: int
    message: str


class SteamAchievementItem(BaseModel):
    """Normalized individual achievement."""
    id: str
    api_name: str
    display_name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    icon_gray_url: Optional[str] = None
    is_hidden: bool = False
    unlocked: bool = False
    unlock_time: Optional[datetime.datetime] = None
    global_percentage: Optional[float] = None


class GameAchievementsResponse(BaseModel):
    """Full achievement progress and catalog for a game."""
    game_id: str
    steam_app_id: Optional[int] = None
    total_count: int
    unlocked_count: int
    completion_pct: float
    completion_suggestion: bool = False
    last_synced_at: Optional[datetime.datetime] = None
    is_available: bool = True
    message: Optional[str] = None
    achievements: List[SteamAchievementItem]


class InstalledGameInfo(BaseModel):
    """Detected local Steam installation."""
    steam_app_id: int
    title: str
    install_dir: str
    executable_path: Optional[str] = None
    size_on_disk_bytes: Optional[int] = None


class DetectorStatusResponse(BaseModel):
    """Status of automatic gameplay monitoring service."""
    is_enabled: bool
    is_monitoring: bool
    detected_libraries: List[str]
    running_game: Optional[Dict[str, Any]] = None


class LaunchConfigResponse(BaseModel):
    """Launch configuration for a game."""
    game_id: str
    title: str
    launch_type: str  # "steam", "executable", "unconfigured"
    steam_app_id: Optional[int] = None
    executable_path: Optional[str] = None
    launch_arguments: Optional[str] = None
    is_installed: bool = False


class SetLaunchConfigRequest(BaseModel):
    """Request to update local executable path or arguments."""
    executable_path: Optional[str] = None
    launch_arguments: Optional[str] = None


class PriceInfoItem(BaseModel):
    """Normalized price and deal information for a wishlist title."""
    game_id: str
    title: str
    current_price: Optional[float] = None
    regular_price: Optional[float] = None
    discount_percent: int = 0
    historical_low_price: Optional[float] = None
    store_deal_name: Optional[str] = None
    deal_url: Optional[str] = None
    currency: str = "INR"
    is_deal_active: bool = False
    target_price: Optional[float] = None
    price_updated_at: Optional[datetime.datetime] = None


class WishlistPricesResponse(BaseModel):
    """Response containing wishlist price updates and provider state."""
    has_api_key: bool
    currency: str = "INR"
    items: List[PriceInfoItem]
    deals_meeting_target: int
    last_updated: Optional[datetime.datetime] = None
