"""Pydantic schemas for Play Sessions, Scheduled Sessions, Active Sessions, and Journal."""
import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.library import LibraryEntryRead


# ---------------- Scheduled Sessions (Planner) ----------------

class ScheduledSessionCreate(BaseModel):
    library_entry_id: str = Field(..., description="Target library game UUID")
    scheduled_start: datetime.datetime = Field(..., description="Planned session start timestamp with timezone")
    duration_minutes: int = Field(default=60, gt=0, le=1440, description="Duration in minutes (1m to 24h)")
    reminder_minutes_before: Optional[int] = Field(default=15, ge=0, le=1440)
    repeat_schedule: str = Field(default="none", description="none, daily, weekly, weekdays, weekends")
    status: str = Field(default="Scheduled", description="Scheduled, In Progress, Completed, Cancelled, Missed")
    notes: Optional[str] = None


class ScheduledSessionUpdate(BaseModel):
    scheduled_start: Optional[datetime.datetime] = None
    duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    reminder_minutes_before: Optional[int] = None
    repeat_schedule: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ScheduledSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    library_entry_id: str
    scheduled_start: datetime.datetime
    duration_minutes: int
    reminder_minutes_before: Optional[int] = None
    repeat_schedule: str
    status: str
    notes: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    library_entry: Optional[LibraryEntryRead] = None
    conflict_warning: Optional[str] = None


class ScheduledSessionCompleteRequest(BaseModel):
    actual_duration_minutes: Optional[int] = Field(default=None, gt=0)
    log_as_play_session: bool = Field(default=True, description="Whether to also record this in play_sessions")
    notes: Optional[str] = None


# ---------------- Active & Live Play Sessions ----------------

class ActiveSessionStart(BaseModel):
    library_entry_id: str = Field(..., description="Target library game UUID")
    location_or_chapter: Optional[str] = None
    notes: Optional[str] = None


class ActiveSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    library_entry_id: str
    start_time: datetime.datetime
    paused_at: Optional[datetime.datetime] = None
    accumulated_seconds: int
    location_or_chapter: Optional[str] = None
    notes: Optional[str] = None
    is_paused: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    elapsed_seconds: int = 0
    library_entry: Optional[LibraryEntryRead] = None


class ActiveSessionEndRequest(BaseModel):
    notes: Optional[str] = None
    location_or_chapter: Optional[str] = None
    progress_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)


# ---------------- Recorded Play Sessions ----------------

class PlaySessionCreate(BaseModel):
    library_entry_id: str
    duration_minutes: int = Field(..., gt=0, description="Duration in minutes")
    session_date: Optional[datetime.datetime] = None
    location_or_chapter: Optional[str] = None
    notes: Optional[str] = None


class PlaySessionUpdate(BaseModel):
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    session_date: Optional[datetime.datetime] = None
    location_or_chapter: Optional[str] = None
    notes: Optional[str] = None


class PlaySessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    library_entry_id: str
    session_date: datetime.datetime
    duration_minutes: int
    location_or_chapter: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime.datetime

    library_entry: Optional[LibraryEntryRead] = None


# ---------------- Gaming Journal ----------------

class JournalEntryCreate(BaseModel):
    library_entry_id: Optional[str] = Field(default=None, description="Optional game UUID. Null for general notes.")
    title: str = Field(..., min_length=1, max_length=255)
    content_markdown: str = Field(..., min_length=1)
    entry_date: Optional[datetime.datetime] = None
    entry_type: str = Field(default="Note", description="Note, Review, Milestone, Boss Fight, Summary")
    is_spoiler: bool = Field(default=False)
    personal_rating: Optional[float] = Field(default=None, ge=0.0, le=10.0)


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content_markdown: Optional[str] = Field(default=None, min_length=1)
    entry_date: Optional[datetime.datetime] = None
    entry_type: Optional[str] = None
    is_spoiler: Optional[bool] = None
    personal_rating: Optional[float] = Field(default=None, ge=0.0, le=10.0)


class JournalEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    library_entry_id: Optional[str] = None
    title: str
    content_markdown: str
    entry_date: datetime.datetime
    entry_type: str
    is_spoiler: bool
    personal_rating: Optional[float] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    library_entry: Optional[LibraryEntryRead] = None
