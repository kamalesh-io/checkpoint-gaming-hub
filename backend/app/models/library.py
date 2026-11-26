"""SQLAlchemy model for personal library entries with decoupled statuses."""
import datetime
import enum
import uuid
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class PlayingStatus(str, enum.Enum):
    PLANNED = "Planned"
    CURRENTLY_PLAYING = "Currently Playing"
    ON_HOLD = "On Hold"
    COMPLETED = "Completed"
    ONE_HUNDRED_PERCENT = "100% Completed"
    DROPPED = "Dropped"


class OwnershipStatus(str, enum.Enum):
    OWNED = "Owned"
    FAMILY_SHARED = "Family Shared"
    TO_BUY = "To Buy"
    SUBSCRIPTION = "Subscription"
    UNKNOWN = "Unknown"


class Priority(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class CompletionGoal(str, enum.Enum):
    MAIN_STORY = "Main Story"
    MAIN_EXTRA = "Main + Side Quests"
    ONE_HUNDRED_PERCENT = "100% Completion"


class LibraryEntry(Base, TimestampMixin):
    """Represents a user's tracked instance of a game."""

    __tablename__ = "library_entries"
    __table_args__ = (
        CheckConstraint("progress_pct >= 0.0 AND progress_pct <= 100.0", name="chk_progress_pct"),
        CheckConstraint("hours_played >= 0.0", name="chk_hours_played"),
        CheckConstraint("personal_rating IS NULL OR (personal_rating >= 0.0 AND personal_rating <= 10.0)", name="chk_personal_rating"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Decoupled status fields
    playing_status: Mapped[str] = mapped_column(String(32), default=PlayingStatus.PLANNED.value, nullable=False, index=True)
    ownership_status: Mapped[str] = mapped_column(String(32), default=OwnershipStatus.OWNED.value, nullable=False, index=True)

    platform: Mapped[str] = mapped_column(String(32), default="Steam", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(16), default=Priority.MEDIUM.value, nullable=False, index=True)
    queue_position: Mapped[int] = mapped_column(Integer, default=0, index=True)

    # Progress and metrics
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    hours_played: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    personal_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    completion_goal: Mapped[str] = mapped_column(String(32), default=CompletionGoal.MAIN_STORY.value, nullable=False)

    # Steam synchronization (kept distinct from hours_played)
    steam_playtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    steam_last_played_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Local launch configuration (Phase 6E)
    executable_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    launch_arguments: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Planning dates
    planned_start_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    target_completion_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    custom_tags: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Relationships
    game: Mapped["Game"] = relationship("Game", back_populates="library_entry", lazy="joined")
    play_sessions: Mapped[List["PlaySession"]] = relationship("PlaySession", back_populates="library_entry", cascade="all, delete-orphan", lazy="selectin")
    scheduled_sessions: Mapped[List["ScheduledSession"]] = relationship("ScheduledSession", back_populates="library_entry", cascade="all, delete-orphan", lazy="selectin")
    journal_entries: Mapped[List["JournalEntry"]] = relationship("JournalEntry", back_populates="library_entry", cascade="all, delete-orphan", lazy="selectin")
    collection_items: Mapped[List["CollectionItem"]] = relationship("CollectionItem", back_populates="library_entry", cascade="all, delete-orphan")
