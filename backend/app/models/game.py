"""SQLAlchemy models for Games, Franchises, Genres, and Themes."""
import uuid
import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.achievement import SteamAchievement

# Association table: Game <-> Genre
game_genres = Table(
    "game_genres",
    Base.metadata,
    Column("game_id", String(36), ForeignKey("games.id", ondelete="CASCADE"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
)

# Association table: Game <-> Theme
game_themes = Table(
    "game_themes",
    Base.metadata,
    Column("game_id", String(36), ForeignKey("games.id", ondelete="CASCADE"), primary_key=True),
    Column("theme_id", Integer, ForeignKey("themes.id", ondelete="CASCADE"), primary_key=True),
)


class Franchise(Base, TimestampMixin):
    """Series or franchise grouping (e.g. 'The Witcher', 'Metro')."""

    __tablename__ = "franchises"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    games: Mapped[List["Game"]] = relationship("Game", back_populates="franchise")


class Genre(Base):
    """Video game genre lookup (e.g. 'Role-playing (RPG)')."""

    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # IGDB genre ID
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    games: Mapped[List["Game"]] = relationship("Game", secondary=game_genres, back_populates="genres")


class Theme(Base):
    """Video game theme lookup (e.g. 'Science fiction', 'Dark fantasy')."""

    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # IGDB theme ID
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    games: Mapped[List["Game"]] = relationship("Game", secondary=game_themes, back_populates="themes")


class Game(Base, TimestampMixin):
    """Canonical game entity registered from IGDB metadata."""

    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    igdb_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storyline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    release_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    developer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    igdb_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    game_type: Mapped[Optional[str]] = mapped_column(String(50), default="main_game")
    
    # External store linking (crucial for SteamGridDB accurate matching)
    steam_app_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    steamgriddb_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    franchise_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("franchises.id", ondelete="SET NULL"), nullable=True
    )
    franchise_order: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    raw_metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    franchise: Mapped[Optional["Franchise"]] = relationship("Franchise", back_populates="games")
    genres: Mapped[List["Genre"]] = relationship("Genre", secondary=game_genres, back_populates="games", lazy="selectin")
    themes: Mapped[List["Theme"]] = relationship("Theme", secondary=game_themes, back_populates="games", lazy="selectin")
    library_entry: Mapped[Optional["LibraryEntry"]] = relationship("LibraryEntry", back_populates="game", uselist=False, cascade="all, delete-orphan")
    artworks: Mapped[List["GameArtwork"]] = relationship("GameArtwork", back_populates="game", cascade="all, delete-orphan", lazy="selectin")
    achievements: Mapped[List["SteamAchievement"]] = relationship("SteamAchievement", back_populates="game", cascade="all, delete-orphan", lazy="selectin")
