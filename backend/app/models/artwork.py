"""SQLAlchemy model for Game Artwork and cached assets."""
import enum
import uuid
from typing import Optional
from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class AssetType(str, enum.Enum):
    COVER = "cover"              # 2:3 portrait grid
    HERO = "hero"                # 16:9 landscape background
    LOGO = "logo"                # Transparent PNG title logo
    SCREENSHOT = "screenshot"    # In-game gameplay screenshot
    ICON = "icon"                # Small square avatar / favicon
    ANIMATED = "animated"        # Animated cover/hero (WebM, GIF)


class ArtworkSource(str, enum.Enum):
    STEAMGRIDDB = "steamgriddb"
    IGDB = "igdb"
    CUSTOM = "custom"


class GameArtwork(Base, TimestampMixin):
    """Artwork asset metadata linked to a game."""

    __tablename__ = "game_artworks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)

    asset_type: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    remote_url: Mapped[str] = mapped_column(Text, nullable=False)
    local_path: Mapped[str] = mapped_column(Text, default="", nullable=False)

    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    sha256_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_animated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default=ArtworkSource.STEAMGRIDDB.value, nullable=False)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    game: Mapped["Game"] = relationship("Game", back_populates="artworks")
