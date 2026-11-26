"""Collections API Router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.collection import (
    CollectionCreate,
    CollectionItemAdd,
    CollectionRead,
    CollectionReorderRequest,
    CollectionUpdate,
)
from app.services.collections import CollectionService

router = APIRouter(prefix="/collections", tags=["Custom Collections"])


@router.get("", response_model=List[CollectionRead])
async def list_collections(db: AsyncSession = Depends(get_db)):
    """Retrieves all user custom collections with game count and completion statistics."""
    service = CollectionService(db)
    return await service.list_collections()


@router.post("", response_model=CollectionRead, status_code=status.HTTP_201_CREATED)
async def create_collection(
    payload: CollectionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a custom game collection."""
    service = CollectionService(db)
    return await service.create_collection(payload)


@router.get("/{collection_id}", response_model=CollectionRead)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieves a single collection with ordered games."""
    service = CollectionService(db)
    return await service.get_collection(collection_id)


@router.patch("/{collection_id}", response_model=CollectionRead)
async def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates name, description, banner, or display order of collection."""
    service = CollectionService(db)
    return await service.update_collection(collection_id, payload)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Deletes collection without removing games from library."""
    service = CollectionService(db)
    deleted = await service.delete_collection(collection_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found.")
    return None


@router.post("/{collection_id}/items", response_model=CollectionRead)
async def add_item_to_collection(
    collection_id: str,
    payload: CollectionItemAdd,
    db: AsyncSession = Depends(get_db),
):
    """Adds a game to collection."""
    service = CollectionService(db)
    return await service.add_item(collection_id, payload)


@router.delete("/{collection_id}/items/{library_entry_id}", response_model=CollectionRead)
async def remove_item_from_collection(
    collection_id: str,
    library_entry_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Removes a game from collection without deleting it from library."""
    service = CollectionService(db)
    return await service.remove_item(collection_id, library_entry_id)


@router.post("/{collection_id}/reorder", response_model=CollectionRead)
async def reorder_collection_items(
    collection_id: str,
    payload: CollectionReorderRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reorders items inside collection."""
    service = CollectionService(db)
    return await service.reorder_items(collection_id, payload)
