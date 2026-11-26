"""Search and IGDB metadata discovery endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.repositories.library_repo import LibraryRepository
from app.schemas.artwork import SteamGridDBAssetsResponse, SteamGridDBItem
from app.schemas.search import IGDBSearchResponse, IGDBSearchResultItem
from app.services.igdb import igdb_client
from app.services.steamgriddb import steamgriddb_client

router = APIRouter(tags=["Search & Metadata"])


@router.get("/search", response_model=IGDBSearchResponse)
@router.get("/search/igdb", response_model=IGDBSearchResponse)
async def search_catalog(
    q: str = Query(..., min_length=1, description="Game title search query"),
    limit: int = Query(10, ge=1, le=25),
    db: AsyncSession = Depends(get_db),
):
    """Searches the global IGDB catalog and marks games already in user's library."""
    items = await igdb_client.search_games(search_text=q, limit=limit)

    # Check local library for existing games
    repo = LibraryRepository(db)
    formatted: List[IGDBSearchResultItem] = []
    for item in items:
        existing = await repo.get_by_igdb_id(item["igdb_id"])
        if existing:
            item["in_library"] = True
            item["library_entry_id"] = existing.id
        formatted.append(IGDBSearchResultItem(**item))

    return IGDBSearchResponse(data=formatted)


@router.get("/games/{igdb_id}")
async def get_game_metadata(igdb_id: int):
    """Retrieves full normalized metadata for a specific IGDB game ID."""
    details = await igdb_client.get_game_details(igdb_id)
    if not details:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Game not found on IGDB.")
    return details


@router.get("/games/{igdb_id}/artwork", response_model=SteamGridDBAssetsResponse)
async def get_game_artwork_options(igdb_id: int):
    """Retrieves alternative SteamGridDB artwork candidates for an IGDB game."""
    details = await igdb_client.get_game_details(igdb_id)
    if not details:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Game not found on IGDB.")

    title = details["title"]
    steam_app_id = details.get("steam_app_id")

    sgdb_data = await steamgriddb_client.get_all_artwork(title, steam_app_id)
    return SteamGridDBAssetsResponse(
        game_id=str(igdb_id),
        grids=[SteamGridDBItem(**g) for g in sgdb_data.get("grids", [])],
        heroes=[SteamGridDBItem(**h) for h in sgdb_data.get("heroes", [])],
        logos=[SteamGridDBItem(**l) for l in sgdb_data.get("logos", [])],
    )
