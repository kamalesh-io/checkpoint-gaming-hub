"""Play Sessions API Router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.session import (
    ActiveSessionEndRequest,
    ActiveSessionRead,
    ActiveSessionStart,
    PlaySessionCreate,
    PlaySessionRead,
    PlaySessionUpdate,
)
from app.services.play_sessions import PlaySessionService

router = APIRouter(prefix="/sessions", tags=["Play Session Tracking"])


@router.get("/active", response_model=Optional[ActiveSessionRead])
async def get_active_session(db: AsyncSession = Depends(get_db)):
    """Returns currently running or paused session for live timer or restart recovery."""
    service = PlaySessionService(db)
    return await service.get_active_session()


@router.post("/start", response_model=Optional[ActiveSessionRead])
async def start_session(
    payload: ActiveSessionStart,
    db: AsyncSession = Depends(get_db),
):
    """Starts live gameplay tracking for a game."""
    service = PlaySessionService(db)
    return await service.start_session(payload)


@router.post("/pause", response_model=Optional[ActiveSessionRead])
async def pause_session(db: AsyncSession = Depends(get_db)):
    """Pauses live tracking timer."""
    service = PlaySessionService(db)
    return await service.pause_session()


@router.post("/resume", response_model=Optional[ActiveSessionRead])
async def resume_session(db: AsyncSession = Depends(get_db)):
    """Resumes live tracking timer."""
    service = PlaySessionService(db)
    return await service.resume_session()


@router.post("/end", response_model=PlaySessionRead)
async def end_session(
    payload: ActiveSessionEndRequest,
    db: AsyncSession = Depends(get_db),
):
    """Ends live session, saves to history, and updates game cumulative hours."""
    service = PlaySessionService(db)
    return await service.end_session(payload)


@router.post("/discard", status_code=status.HTTP_204_NO_CONTENT)
async def discard_session(db: AsyncSession = Depends(get_db)):
    """Discards active session without saving playtime."""
    service = PlaySessionService(db)
    await service.discard_active_session()
    return None


@router.post("/manual", response_model=PlaySessionRead, status_code=status.HTTP_201_CREATED)
async def log_manual_session(
    payload: PlaySessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Manually logs past gameplay duration."""
    service = PlaySessionService(db)
    return await service.log_manual_session(payload)


@router.get("/history", response_model=List[PlaySessionRead])
async def list_session_history(
    entry_id: Optional[str] = Query(None, description="Filter by library game UUID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Lists logged play session history."""
    service = PlaySessionService(db)
    return await service.list_history(entry_id=entry_id, limit=limit, offset=offset)


@router.patch("/history/{session_id}", response_model=PlaySessionRead)
async def update_session_history(
    session_id: str,
    payload: PlaySessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates duration or notes of a past session and adjusts total game hours."""
    service = PlaySessionService(db)
    return await service.update_history(session_id, payload)


@router.delete("/history/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Deletes a past session and decrements game hours."""
    service = PlaySessionService(db)
    deleted = await service.delete_history(session_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return None
