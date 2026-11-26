"""Pydantic schemas for Games, Genres, and Franchises."""
import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.artwork import ArtworkRead


class GenreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: Optional[str] = None


class ThemeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: Optional[str] = None


class FranchiseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: Optional[str] = None


class GameArtworkBundle(BaseModel):
    cover_url: Optional[str] = None
    hero_url: Optional[str] = None
    logo_url: Optional[str] = None


class GameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    igdb_id: int
    title: str
    slug: str
    summary: Optional[str] = None
    storyline: Optional[str] = None
    release_date: Optional[datetime.date] = None
    developer: Optional[str] = None
    publisher: Optional[str] = None
    igdb_rating: Optional[float] = None
    igdb_rating_count: Optional[int] = None
    game_type: Optional[str] = "main_game"
    steam_app_id: Optional[int] = None
    platforms: List[str] = []

    franchise: Optional[FranchiseRead] = None
    genres: List[GenreRead] = []
    themes: List[ThemeRead] = []
    artworks: List[ArtworkRead] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime
