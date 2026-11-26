"""SQLAlchemy models for Play Sessions, Scheduled Sessions, Active Sessions, and Gaming Journal."""
import datetime
import uuid
from typing import Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class PlaySession(Base, TimestampMixin):
    """Historical record of an individual manual or tracked play session."""

    __tablename__ = "play_sessions"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="chk_session_duration"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    library_entry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("library_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )

    session_date: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
        index=True,
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    location_or_chapter: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    library_entry: Mapped["LibraryEntry"] = relationship("LibraryEntry", back_populates="play_sessions")


class ActivePlaySession(Base, TimestampMixin):
    """Persisted in-progress or paused gaming session for crash and restart recovery."""

    __tablename__ = "active_play_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    library_entry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("library_entries.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )

    start_time: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    paused_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accumulated_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    location_or_chapter: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    library_entry: Mapped["LibraryEntry"] = relationship("LibraryEntry")


class ScheduledSession(Base, TimestampMixin):
    """Calendar scheduled session for planned gaming time."""

    __tablename__ = "scheduled_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    library_entry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("library_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )

    scheduled_start: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    reminder_minutes_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    repeat_schedule: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Scheduled", nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    library_entry: Mapped["LibraryEntry"] = relationship("LibraryEntry")


class JournalEntry(Base, TimestampMixin):
    """Personal rich notes, boss reflections, milestones, and reviews for a game or general gaming."""

    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    library_entry_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("library_entries.id", ondelete="CASCADE"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    entry_date: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
        index=True,
    )
    entry_type: Mapped[str] = mapped_column(String(32), default="Note", nullable=False, index=True)
    is_spoiler: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    personal_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    library_entry: Mapped[Optional["LibraryEntry"]] = relationship("LibraryEntry", back_populates="journal_entries")
