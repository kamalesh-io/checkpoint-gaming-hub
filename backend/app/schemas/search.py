"""Pydantic schemas for IGDB Search and Discovery."""
from typing import List, Optional
from pydantic import BaseModel


class IGDBSearchResultItem(BaseModel):
    igdb_id: int
    title: str
    slug: str
    category: Optional[str] = "base_game"
    game_type: Optional[int] = 0
    version_parent: Optional[int] = None
    parent_game: Optional[int] = None
    release_year: Optional[int] = None
    developer: Optional[str] = None
    publisher: Optional[str] = None
    genres: List[str] = []
    platforms: List[str] = []
    igdb_rating: Optional[float] = None
    cover_url: Optional[str] = None
    in_library: bool = False
    library_entry_id: Optional[str] = None


class IGDBSearchResponse(BaseModel):
    data: List[IGDBSearchResultItem]
