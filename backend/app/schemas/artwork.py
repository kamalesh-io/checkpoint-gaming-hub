"""Pydantic schemas for Artwork assets and SteamGridDB."""
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ArtworkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    game_id: str
    asset_type: str
    remote_url: str
    local_path: Optional[str] = ""
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    is_active: Optional[bool] = True
    is_animated: Optional[bool] = False
    source: Optional[str] = "steamgriddb"
    author: Optional[str] = None
    cached_url: Optional[str] = None


# Aliases for router compatibility
GameArtworkResponse = ArtworkRead


class ArtworkSelectRequest(BaseModel):
    asset_id: Optional[str] = None
    game_id: Optional[str] = None
    asset_type: Optional[str] = Field(None, description="cover, hero, or logo")
    steamgriddb_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    author: Optional[str] = None


class CacheCategoryStats(BaseModel):
    count: int
    size_bytes: int


class CacheStatusRead(BaseModel):
    total_files: int
    total_size_bytes: int
    formatted_size: str
    cache_directory: str
    categories: Dict[str, CacheCategoryStats]


class SteamGridDBItem(BaseModel):
    id: int
    url: str
    thumb: str
    width: int
    height: int
    author: Optional[str] = None
    score: Optional[int] = None


class SteamGridDBAssetsResponse(BaseModel):
    game_id: str
    grids: List[SteamGridDBItem] = []
    heroes: List[SteamGridDBItem] = []
    logos: List[SteamGridDBItem] = []
    icons: List[SteamGridDBItem] = []
