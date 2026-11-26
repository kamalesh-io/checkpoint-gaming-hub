"""Gaming Planner API Router."""
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.session import (
    ScheduledSessionCompleteRequest,
    ScheduledSessionCreate,
    ScheduledSessionRead,
    ScheduledSessionUpdate,
)
from app.services.planner import PlannerService

router = APIRouter(prefix="/planner", tags=["Gaming Planner & Calendar"])


@router.get("/sessions", response_model=List[ScheduledSessionRead])
async def list_scheduled_sessions(
    start: Optional[datetime.datetime] = Query(None, description="Start date window"),
    end: Optional[datetime.datetime] = Query(None, description="End date window"),
    status: Optional[str] = Query(None, description="Filter: Scheduled, In Progress, Completed, Cancelled, Missed"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves all scheduled calendar sessions within specified range."""
    service = PlannerService(db)
    return await service.list_sessions(start_date=start, end_date=end, status=status)


@router.post("/sessions", response_model=ScheduledSessionRead, status_code=status.HTTP_201_CREATED)
async def create_scheduled_session(
    payload: ScheduledSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new calendar gaming session with non-blocking conflict warnings."""
    service = PlannerService(db)
    return await service.create_session(payload)


@router.patch("/sessions/{session_id}", response_model=ScheduledSessionRead)
async def update_scheduled_session(
    session_id: str,
    payload: ScheduledSessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates timing, duration, notes or status of a scheduled session."""
    service = PlannerService(db)
    return await service.update_session(session_id, payload)


@router.post("/sessions/{session_id}/complete", response_model=ScheduledSessionRead)
async def complete_scheduled_session(
    session_id: str,
    payload: ScheduledSessionCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Marks session complete and optionally logs actual playtime."""
    service = PlannerService(db)
    return await service.complete_session(session_id, payload)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Removes a scheduled gaming session."""
    service = PlannerService(db)
    deleted = await service.delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduled session '{session_id}' not found.",
        )
    return None
