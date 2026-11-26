"""Exports all Pydantic schemas."""
from app.schemas.common import ErrorDetail, ErrorResponse, PaginatedResponse, PaginationMeta
from app.schemas.game import FranchiseRead, GameArtworkBundle, GameRead, GenreRead, ThemeRead
from app.schemas.library import LibraryEntryCreate, LibraryEntryRead, LibraryEntryUpdate
from app.schemas.artwork import ArtworkRead, ArtworkSelectRequest, CacheStatusRead, SteamGridDBAssetsResponse, SteamGridDBItem
from app.schemas.search import IGDBSearchResponse, IGDBSearchResultItem
from app.schemas.session import JournalEntryCreate, JournalEntryRead, PlaySessionCreate, PlaySessionRead
from app.schemas.system import HealthResponse, IntegrationStatus, SystemStatsResponse

__all__ = [
    "PaginationMeta",
    "PaginatedResponse",
    "ErrorDetail",
    "ErrorResponse",
    "GameRead",
    "GenreRead",
    "ThemeRead",
    "FranchiseRead",
    "GameArtworkBundle",
    "LibraryEntryCreate",
    "LibraryEntryRead",
    "LibraryEntryUpdate",
    "ArtworkRead",
    "ArtworkSelectRequest",
    "CacheStatusRead",
    "SteamGridDBItem",
    "SteamGridDBAssetsResponse",
    "IGDBSearchResultItem",
    "IGDBSearchResponse",
    "PlaySessionCreate",
    "PlaySessionRead",
    "JournalEntryCreate",
    "JournalEntryRead",
    "HealthResponse",
    "IntegrationStatus",
    "SystemStatsResponse",
]
