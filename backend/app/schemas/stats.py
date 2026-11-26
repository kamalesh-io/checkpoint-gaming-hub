"""Pydantic schemas for Gaming Analytics & Statistics."""
import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class MonthlyActivityItem(BaseModel):
    month: str  # YYYY-MM
    hours_played: float
    sessions_count: int
    completed_count: int


class GenreStatsItem(BaseModel):
    genre: str
    hours_played: float
    game_count: int


class PlatformStatsItem(BaseModel):
    platform: str
    game_count: int
    hours_played: float


class MostPlayedGameItem(BaseModel):
    entry_id: str
    title: str
    hours_played: float
    personal_rating: Optional[float] = None
    cover_url: Optional[str] = None
    platform: str
    playing_status: str


class FranchiseProgressItem(BaseModel):
    franchise_name: str
    total_games: int
    completed_games: int
    completion_pct: float
    total_hours: float


class HeatmapDayItem(BaseModel):
    date: str  # YYYY-MM-DD
    minutes: int
    session_count: int


class GamingStatsResponse(BaseModel):
    total_games: int
    currently_playing: int
    planned: int
    completed: int
    one_hundred_percent: int
    on_hold: int
    dropped: int
    wishlist_count: int

    total_hours_logged: float
    average_personal_rating: Optional[float] = None
    backlog_completion_pct: float

    monthly_activity: List[MonthlyActivityItem]
    hours_by_genre: List[GenreStatsItem]
    platform_distribution: List[PlatformStatsItem]
    most_played_games: List[MostPlayedGameItem]
    franchise_progress: List[FranchiseProgressItem]
    heatmap: List[HeatmapDayItem]
    yearly_summary: Dict[str, Dict[str, float]]
