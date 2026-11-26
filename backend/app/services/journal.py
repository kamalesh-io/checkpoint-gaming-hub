"""Gaming Journal service managing notes, reflections, milestones, and reviews."""
import datetime
from typing import List, Optional
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import EntityNotFoundException
from app.models.game import Game
from app.models.library import LibraryEntry
from app.models.session import JournalEntry
from app.schemas.session import JournalEntryCreate, JournalEntryRead, JournalEntryUpdate
from app.services.library import LibraryService


class JournalService:
    """Manages rich playthrough logs, boss completions, reviews, and spoiler tags."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.library_service = LibraryService(session)

    def _format_entry(self, entry: JournalEntry) -> JournalEntryRead:
        entry_read = self.library_service.format_entry_response(entry.library_entry) if entry.library_entry else None
        return JournalEntryRead(
            id=entry.id,
            library_entry_id=entry.library_entry_id,
            title=entry.title,
            content_markdown=entry.content_markdown,
            entry_date=entry.entry_date,
            entry_type=entry.entry_type,
            is_spoiler=entry.is_spoiler,
            personal_rating=entry.personal_rating,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
            library_entry=entry_read,
        )

    async def list_entries(
        self,
        library_entry_id: Optional[str] = None,
        entry_type: Optional[str] = None,
        is_spoiler: Optional[bool] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[JournalEntryRead]:
        """Lists journal entries with filtering and search."""
        stmt = (
            select(JournalEntry)
            .options(
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
            .order_by(desc(JournalEntry.entry_date))
            .offset(offset)
            .limit(limit)
        )

        if library_entry_id:
            stmt = stmt.where(JournalEntry.library_entry_id == library_entry_id)
        if entry_type and entry_type.lower() != "all":
            stmt = stmt.where(JournalEntry.entry_type == entry_type)
        if is_spoiler is not None:
            stmt = stmt.where(JournalEntry.is_spoiler == is_spoiler)
        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(or_(JournalEntry.title.ilike(term), JournalEntry.content_markdown.ilike(term)))

        res = await self.session.execute(stmt)
        return [self._format_entry(e) for e in res.scalars().all()]

    async def get_entry(self, entry_id: str) -> JournalEntryRead:
        """Retrieves single journal entry."""
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.id == entry_id)
            .options(
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        res = await self.session.execute(stmt)
        entry = res.scalar_one_or_none()
        if not entry:
            raise EntityNotFoundException("JournalEntry", entry_id)
        return self._format_entry(entry)

    async def create_entry(self, payload: JournalEntryCreate) -> JournalEntryRead:
        """Creates a journal entry."""
        if payload.library_entry_id:
            lib_entry = await self.session.get(LibraryEntry, payload.library_entry_id)
            if not lib_entry:
                raise EntityNotFoundException("LibraryEntry", payload.library_entry_id)

        entry = JournalEntry(
            library_entry_id=payload.library_entry_id,
            title=payload.title,
            content_markdown=payload.content_markdown,
            entry_date=payload.entry_date or datetime.datetime.now(datetime.timezone.utc),
            entry_type=payload.entry_type,
            is_spoiler=payload.is_spoiler,
            personal_rating=payload.personal_rating,
        )
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return await self.get_entry(entry.id)

    async def update_entry(self, entry_id: str, updates: JournalEntryUpdate) -> JournalEntryRead:
        """Updates a journal entry."""
        entry = await self.session.get(JournalEntry, entry_id)
        if not entry:
            raise EntityNotFoundException("JournalEntry", entry_id)

        for k, v in updates.model_dump(exclude_unset=True).items():
            setattr(entry, k, v)

        await self.session.commit()
        return await self.get_entry(entry_id)

    async def delete_entry(self, entry_id: str) -> bool:
        """Deletes a journal entry."""
        entry = await self.session.get(JournalEntry, entry_id)
        if not entry:
            return False
        await self.session.delete(entry)
        await self.session.commit()
        return True
