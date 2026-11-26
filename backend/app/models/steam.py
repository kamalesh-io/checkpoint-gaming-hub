"""SQLAlchemy model for Steam Account integration state."""
import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, TimestampMixin


class SteamAccount(Base, TimestampMixin):
    """Connected Steam account information and synchronization state."""

    __tablename__ = "steam_accounts"

    steam_id_64: Mapped[str] = mapped_column(String(32), primary_key=True)
    persona_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    profile_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    community_visibility_state: Mapped[int] = mapped_column(Integer, default=3, nullable=False)  # 3 = public
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sync_interval_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    last_synced_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
