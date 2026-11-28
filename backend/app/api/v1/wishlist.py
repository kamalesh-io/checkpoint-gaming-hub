"""Wishlist API Router with purchase tracking and library conversion."""
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import DuplicateEntityException, EntityNotFoundException
from app.database.session import get_db
from app.models.artwork import AssetType, GameArtwork
from app.models.collection import WishlistItem
from app.models.game import Game
from app.models.library import LibraryEntry
from app.schemas.collection import (
    WishlistConvertToLibraryRequest,
    WishlistItemCreate,
    WishlistItemRead,
    WishlistItemUpdate,
)
from app.schemas.library import LibraryEntryRead
from app.services.igdb import igdb_client
from app.services.library import LibraryService

router = APIRouter(prefix="/wishlist", tags=["Wishlist Management"])


@router.get("", response_model=List[WishlistItemRead])
async def list_wishlist(
    priority: Optional[str] = Query(None, description="Filter: Low, Medium, High"),
    store: Optional[str] = Query(None, description="Filter store preference"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves all tracked wishlist games."""
    stmt = (
        select(WishlistItem)
        .options(
            selectinload(WishlistItem.game).selectinload(Game.artworks),
            selectinload(WishlistItem.game).selectinload(Game.genres),
            selectinload(WishlistItem.game).selectinload(Game.themes),
            selectinload(WishlistItem.game).selectinload(Game.franchise),
        )
        .order_by(WishlistItem.created_at.desc())
    )
    if priority and priority.lower() != "all":
        stmt = stmt.where(WishlistItem.priority == priority)
    if store and store.lower() != "all":
        stmt = stmt.where(WishlistItem.store_preference == store)

    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=WishlistItemRead, status_code=status.HTTP_201_CREATED)
async def add_to_wishlist(
    payload: WishlistItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Adds an unowned game to wishlist, fetching metadata from IGDB if not yet cached."""
    # Check if already in library
    lib_stmt = select(LibraryEntry).join(Game, LibraryEntry.game_id == Game.id).where(Game.igdb_id == payload.igdb_id)
    lib_res = await db.execute(lib_stmt)
    existing_lib = lib_res.scalar_one_or_none()
    if existing_lib:
        if existing_lib.ownership_status == "To Buy":
            # Clean up mistaken library entry so it becomes a pure wishlist item
            await db.delete(existing_lib)
            await db.flush()
        else:
            raise DuplicateEntityException(f"Game with IGDB ID {payload.igdb_id} is already in your personal library.")

    # Check if already in wishlist
    wl_stmt = select(WishlistItem).join(Game, WishlistItem.game_id == Game.id).where(Game.igdb_id == payload.igdb_id)
    wl_res = await db.execute(wl_stmt)
    if wl_res.scalar_one_or_none():
        raise DuplicateEntityException(f"Game with IGDB ID {payload.igdb_id} is already on your wishlist.")

    # Find or register Game
    g_stmt = select(Game).where(Game.igdb_id == payload.igdb_id)
    g_res = await db.execute(g_stmt)
    game = g_res.scalar_one_or_none()

    if not game:
        details = await igdb_client.get_game_details(payload.igdb_id)
        if not details:
            raise EntityNotFoundException("Game", str(payload.igdb_id))

        game = Game(
            igdb_id=details["id"],
            title=details["name"],
            slug=details.get("slug") or f"game-{details['id']}",
            summary=details.get("summary"),
            storyline=details.get("storyline"),
            release_date=datetime.date.fromtimestamp(details["first_release_date"]) if details.get("first_release_date") else None,
            igdb_rating=details.get("rating"),
        )
        db.add(game)
        await db.flush()

        # Cache cover artwork
        if details.get("cover") and details["cover"].get("image_id"):
            img_id = details["cover"]["image_id"]
            cover_url = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{img_id}.jpg"
            art = GameArtwork(
                game_id=game.id,
                asset_type=AssetType.COVER.value,
                remote_url=cover_url,
                local_path="",
                is_active=True,
                is_animated=False,
                source="igdb",
            )
            db.add(art)

    item = WishlistItem(
        game_id=game.id,
        priority=payload.priority,
        target_price=payload.target_price,
        currency=payload.currency,
        store_preference=payload.store_preference,
        notes=payload.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    loaded = await db.execute(
        select(WishlistItem)
        .where(WishlistItem.id == item.id)
        .options(
            selectinload(WishlistItem.game).selectinload(Game.artworks),
            selectinload(WishlistItem.game).selectinload(Game.genres),
            selectinload(WishlistItem.game).selectinload(Game.themes),
            selectinload(WishlistItem.game).selectinload(Game.franchise),
        )
    )
    return loaded.scalar_one()


@router.patch("/{item_id}", response_model=WishlistItemRead)
async def update_wishlist_item(
    item_id: str,
    payload: WishlistItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates purchase priority, target price, currency, or notes."""
    item = await db.get(WishlistItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found.")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)

    await db.commit()
    await db.refresh(item)

    loaded = await db.execute(
        select(WishlistItem)
        .where(WishlistItem.id == item.id)
        .options(
            selectinload(WishlistItem.game).selectinload(Game.artworks),
            selectinload(WishlistItem.game).selectinload(Game.genres),
            selectinload(WishlistItem.game).selectinload(Game.themes),
            selectinload(WishlistItem.game).selectinload(Game.franchise),
        )
    )
    return loaded.scalar_one()


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_wishlist_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Removes a game from wishlist."""
    item = await db.get(WishlistItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found.")
    await db.delete(item)
    await db.commit()
    return None


@router.post("/{item_id}/convert-to-library", response_model=LibraryEntryRead)
async def convert_wishlist_to_library(
    item_id: str,
    payload: WishlistConvertToLibraryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Converts a wishlist game into an active personal library entry (Mark as Purchased / Move to Backlog)."""
    item = await db.get(WishlistItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found.")

    game_id = item.game_id
    notes = item.notes or ""

    # Remove from wishlist
    await db.delete(item)

    # Check if library entry already exists
    entry = await db.execute(select(LibraryEntry).where(LibraryEntry.game_id == game_id))
    existing_entry = entry.scalar_one_or_none()

    if existing_entry:
        existing_entry.ownership_status = payload.ownership_status
        existing_entry.playing_status = payload.playing_status
        existing_entry.platform = payload.platform
        if payload.priority:
            existing_entry.priority = payload.priority
        await db.commit()
        service = LibraryService(db)
        return service.format_entry_response(existing_entry)

    new_entry = LibraryEntry(
        game_id=game_id,
        playing_status=payload.playing_status,
        ownership_status=payload.ownership_status,
        platform=payload.platform,
        priority=payload.priority or "Medium",
        notes=notes,
    )
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)

    service = LibraryService(db)
    refreshed = await service.library_repo.get_by_id(new_entry.id)
    return service.format_entry_response(refreshed)
