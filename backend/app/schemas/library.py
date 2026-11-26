"""Pydantic schemas for Library entries and management."""
import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.game import GameArtworkBundle, GameRead


class LibraryEntryCreate(BaseModel):
    igdb_id: int = Field(..., description="IGDB game identifier to import")
    playing_status: str = Field(default="Planned", description="Planned, Currently Playing, On Hold, Completed, 100% Completed, Dropped")
    ownership_status: str = Field(default="Owned", description="Owned, Family Shared, To Buy, Subscription, Unknown")
    platform: str = Field(default="Steam", description="Steam, GOG, Epic Games, PlayStation, Xbox, Other")
    priority: str = Field(default="Medium", description="Low, Medium, High")
    completion_goal: str = Field(default="Main Story", description="Main Story, Main + Side Quests, 100% Completion")
    planned_start_date: Optional[datetime.date] = None
    target_completion_date: Optional[datetime.date] = None
    custom_tags: Optional[str] = ""
    notes: Optional[str] = ""
    progress_pct: Optional[float] = Field(default=0.0, ge=0.0, le=100.0)
    hours_played: Optional[float] = Field(default=0.0, ge=0.0)
    personal_rating: Optional[float] = Field(default=None, ge=0.0, le=10.0)


class LibraryEntryUpdate(BaseModel):
    playing_status: Optional[str] = None
    ownership_status: Optional[str] = None
    platform: Optional[str] = None
    priority: Optional[str] = None
    completion_goal: Optional[str] = None
    progress_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    hours_played: Optional[float] = Field(default=None, ge=0.0)
    personal_rating: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    planned_start_date: Optional[datetime.date] = None
    target_completion_date: Optional[datetime.date] = None
    custom_tags: Optional[str] = None
    is_favorite: Optional[bool] = None
    notes: Optional[str] = None
    queue_position: Optional[int] = None


class LibraryEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    game_id: str
    playing_status: str
    ownership_status: str
    platform: str
    priority: str
    queue_position: int
    progress_pct: float
    hours_played: float
    personal_rating: Optional[float] = None
    completion_goal: str
    planned_start_date: Optional[datetime.date] = None
    target_completion_date: Optional[datetime.date] = None
    custom_tags: str = ""
    is_favorite: bool = False
    notes: str = ""
    created_at: datetime.datetime
    updated_at: datetime.datetime

    game: GameRead
    artwork: Optional[GameArtworkBundle] = None
    active_accent: Optional[str] = "primary"
