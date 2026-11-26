"""Gaming Journal API Router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.session import JournalEntryCreate, JournalEntryRead, JournalEntryUpdate
from app.services.journal import JournalService

router = APIRouter(prefix="/journal", tags=["Gaming Journal"])


@router.get("", response_model=List[JournalEntryRead])
async def list_journal_entries(
    entry_id: Optional[str] = Query(None, description="Filter by library game UUID"),
    type: Optional[str] = Query(None, description="Filter: Note, Review, Milestone, Boss Fight, Summary"),
    spoiler: Optional[bool] = Query(None, description="Filter spoiler status"),
    q: Optional[str] = Query(None, description="Search text in title or body"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves chronological journal diary entries with search and filtering."""
    service = JournalService(db)
    return await service.list_entries(
        library_entry_id=entry_id,
        entry_type=type,
        is_spoiler=spoiler,
        search=q,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=JournalEntryRead, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    payload: JournalEntryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new game note, milestone, review or session reflection."""
    service = JournalService(db)
    return await service.create_entry(payload)


@router.get("/{entry_id}", response_model=JournalEntryRead)
async def get_journal_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieves single journal entry."""
    service = JournalService(db)
    return await service.get_entry(entry_id)


@router.patch("/{entry_id}", response_model=JournalEntryRead)
async def update_journal_entry(
    entry_id: str,
    payload: JournalEntryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates title, markdown body, spoiler tag, or rating."""
    service = JournalService(db)
    return await service.update_entry(entry_id, payload)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Deletes a journal entry."""
    service = JournalService(db)
    deleted = await service.delete_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found.")
    return None
