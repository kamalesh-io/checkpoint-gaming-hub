"""Backlog API Router."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.backlog import (
    BacklogMoveRequest,
    BacklogReorderRequest,
    BacklogSetNextRequest,
    BacklogSummaryResponse,
)
from app.services.backlog import BacklogService

router = APIRouter(prefix="/backlog", tags=["Backlog Management"])


@router.get("", response_model=BacklogSummaryResponse)
async def get_backlog(
    status: Optional[str] = Query(None, description="Filter playing status"),
    ownership: Optional[str] = Query(None, description="Filter ownership status"),
    q: Optional[str] = Query(None, description="Search title"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves ranked backlog queue with current Up Next spotlight title."""
    service = BacklogService(db)
    return await service.get_backlog_summary(status_filter=status, ownership_filter=ownership, search=q)


@router.post("/reorder", response_model=BacklogSummaryResponse)
async def reorder_backlog(
    payload: BacklogReorderRequest,
    db: AsyncSession = Depends(get_db),
):
    """Transactionally reorders backlog queue positions."""
    service = BacklogService(db)
    return await service.reorder_queue(payload.items)


@router.post("/{entry_id}/move", response_model=BacklogSummaryResponse)
async def move_backlog_item(
    entry_id: str,
    payload: BacklogMoveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Moves a backlog item up or down one position (controller & keyboard navigation)."""
    service = BacklogService(db)
    return await service.move_item(entry_id, payload.direction)


@router.post("/set-next", response_model=BacklogSummaryResponse)
async def set_as_next_game(
    payload: BacklogSetNextRequest,
    db: AsyncSession = Depends(get_db),
):
    """Promotes an item to position 1 as the primary Up Next game."""
    service = BacklogService(db)
    return await service.set_as_next(payload.entry_id)
