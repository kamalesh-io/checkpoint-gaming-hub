"""Pydantic schemas for Collections, Franchises, and Wishlist."""
import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.game import GameRead
from app.schemas.library import LibraryEntryRead


# ---------------- Collections ----------------

class CollectionItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    collection_id: str
    library_entry_id: str
    display_order: int
    library_entry: LibraryEntryRead


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    banner_url: Optional[str] = None
    is_pinned: bool = Field(default=False)
    display_order: int = Field(default=0)


class CollectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    banner_url: Optional[str] = None
    is_pinned: Optional[bool] = None
    display_order: Optional[int] = None


class CollectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    banner_url: Optional[str] = None
    display_order: int
    is_pinned: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    game_count: int = 0
    completed_count: int = 0
    total_hours: float = 0.0
    items: List[CollectionItemRead] = []


class CollectionItemAdd(BaseModel):
    library_entry_id: str
    display_order: Optional[int] = None


class CollectionReorderRequest(BaseModel):
    entry_ids: List[str] = Field(..., min_length=1, description="Ordered list of library entry IDs")


# ---------------- Franchises ----------------

class FranchiseGameItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: str
    title: str
    release_date: Optional[datetime.date] = None
    franchise_order: Optional[int] = 0
    library_entry: Optional[LibraryEntryRead] = None


class FranchiseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: Optional[str] = None
    total_games: int = 0
    owned_games: int = 0
    completed_games: int = 0
    games: List[FranchiseGameItem] = []


class FranchiseOrderUpdateItem(BaseModel):
    game_id: str
    order: int


class FranchiseOrderUpdateRequest(BaseModel):
    items: List[FranchiseOrderUpdateItem] = Field(..., min_length=1)


class GameFranchiseAssignRequest(BaseModel):
    franchise_name: str = Field(..., min_length=1, max_length=255)
    order: Optional[int] = 0


# ---------------- Wishlist ----------------

class WishlistItemCreate(BaseModel):
    igdb_id: int = Field(..., description="IGDB ID to add to wishlist")
    priority: str = Field(default="Medium", description="Low, Medium, High")
    target_price: Optional[float] = Field(default=None, ge=0.0)
    currency: str = Field(default="INR", max_length=8)
    store_preference: str = Field(default="Any")
    notes: Optional[str] = None


class WishlistItemUpdate(BaseModel):
    priority: Optional[str] = None
    target_price: Optional[float] = Field(default=None, ge=0.0)
    currency: Optional[str] = None
    store_preference: Optional[str] = None
    notes: Optional[str] = None


class WishlistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    game_id: str
    priority: str
    target_price: Optional[float] = None
    currency: str = "INR"
    store_preference: str = "Any"
    notes: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    game: GameRead


class WishlistConvertToLibraryRequest(BaseModel):
    playing_status: str = Field(default="Planned", description="Planned, Currently Playing, etc.")
    ownership_status: str = Field(default="Owned", description="Owned, Family Shared, etc.")
    platform: str = Field(default="Steam")
    priority: Optional[str] = None
