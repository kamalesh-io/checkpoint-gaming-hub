"""Franchise API Router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.collection import (
    FranchiseOrderUpdateRequest,
    FranchiseRead,
    GameFranchiseAssignRequest,
)
from app.services.collections import CollectionService

router = APIRouter(prefix="/franchises", tags=["Franchises & Series"])


@router.get("", response_model=List[FranchiseRead])
async def list_franchises(db: AsyncSession = Depends(get_db)):
    """Lists franchises with constituent games and library ownership."""
    service = CollectionService(db)
    return await service.list_franchises()


@router.patch("/{franchise_id}/order", response_model=FranchiseRead)
async def update_franchise_playing_order(
    franchise_id: str,
    payload: FranchiseOrderUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Customizes chronological or recommended playing order for franchise games."""
    service = CollectionService(db)
    return await service.update_franchise_order(franchise_id, payload)


@router.post("/games/{game_id}/assign")
async def assign_game_to_franchise(
    game_id: str,
    payload: GameFranchiseAssignRequest,
    db: AsyncSession = Depends(get_db),
):
    """Assigns or corrects franchise membership for a game."""
    service = CollectionService(db)
    game = await service.assign_game_franchise(game_id, payload.franchise_name, payload.order)
    return {"status": "success", "game_id": game.id, "franchise_id": game.franchise_id}
