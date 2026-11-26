"""SQLAlchemy model for game achievements (Steam Achievements)."""
import datetime
import uuid
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class SteamAchievement(Base, TimestampMixin):
    """Normalized Steam achievement records linked to canonical games."""

    __tablename__ = "steam_achievements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    api_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    icon_gray_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    unlock_time: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    global_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_synced_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped["Game"] = relationship("Game", back_populates="achievements")
