"""Personal Library CRUD and management endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.repositories.library_repo import LibraryRepository
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.library import LibraryEntryCreate, LibraryEntryRead, LibraryEntryUpdate
from app.services.library import LibraryService

router = APIRouter(prefix="/library", tags=["Personal Library"])


@router.get("", response_model=PaginatedResponse[LibraryEntryRead])
async def list_library_games(
    status: Optional[str] = Query(None, description="Filter by playing status"),
    ownership_status: Optional[str] = Query(None, description="Filter by ownership status"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    genre: Optional[str] = Query(None, description="Filter by genre name"),
    is_favorite: Optional[bool] = Query(None, description="Filter favorites"),
    q: Optional[str] = Query(None, description="Search by title or tags"),
    sort: str = Query("recently_played", description="recently_played, title_asc, progress_desc, priority_desc, rating_desc"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves the user's game library with comprehensive filtering and sorting."""
    service = LibraryService(db)
    repo = LibraryRepository(db)

    entries, total = await repo.list_entries(
        status=status,
        ownership_status=ownership_status,
        platform=platform,
        priority=priority,
        genre=genre,
        is_favorite=is_favorite,
        search_text=q,
        sort_by=sort,
        limit=limit,
        offset=offset,
    )

    formatted = [service.format_entry_response(entry) for entry in entries]
    return PaginatedResponse(
        data=formatted,
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=LibraryEntryRead, status_code=status.HTTP_201_CREATED)
async def add_game_to_library(
    payload: LibraryEntryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Imports a game from IGDB into the personal library and initiates background artwork caching."""
    service = LibraryService(db)
    return await service.add_game(payload)


@router.get("/{entry_id}", response_model=LibraryEntryRead)
async def get_library_game_details(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieves deep details for a specific library game."""
    service = LibraryService(db)
    repo = LibraryRepository(db)
    entry = await repo.get_by_id(entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Library entry '{entry_id}' not found.",
        )
    return service.format_entry_response(entry)


@router.patch("/{entry_id}", response_model=LibraryEntryRead)
async def update_library_game(
    entry_id: str,
    updates: LibraryEntryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates playing status, ownership status, progress %, hours played, or notes."""
    service = LibraryService(db)
    repo = LibraryRepository(db)
    entry = await repo.get_by_id(entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Library entry '{entry_id}' not found.",
        )

    updated = await repo.update_entry(entry, updates.model_dump(exclude_unset=True))
    await db.commit()
    refreshed = await repo.get_by_id(updated.id)
    return service.format_entry_response(refreshed)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_game_from_library(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Removes a game from the personal library."""
    repo = LibraryRepository(db)
    deleted = await repo.delete_entry(entry_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Library entry '{entry_id}' not found.",
        )
    await db.commit()
    return None
