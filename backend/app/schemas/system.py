"""Pydantic schemas for System Status and Health."""
from typing import Dict, Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    database: str = "connected"
    storage_dir: str
    uptime_seconds: float


class IntegrationStatus(BaseModel):
    igdb_connected: bool
    steamgriddb_connected: bool
    twitch_token_active: bool
    details: Optional[Dict[str, str]] = None


class SystemStatsResponse(BaseModel):
    total_library_games: int
    completed_games: int
    total_hours_logged: float
    backlog_count: int
    hours_by_genre: Dict[str, float] = {}
    games_by_platform: Dict[str, int] = {}


class CredentialsUpdateRequest(BaseModel):
    igdb_client_id: Optional[str] = None
    igdb_client_secret: Optional[str] = None
    steamgriddb_api_key: Optional[str] = None


class ShutdownResponse(BaseModel):
    status: str = "shutting_down"
