"""Backlog queue management service with transactional ordering."""
from typing import List, Optional
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import EntityNotFoundException, ValidationException
from app.models.game import Game
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus
from app.schemas.backlog import BacklogReorderItem, BacklogSummaryResponse
from app.schemas.library import LibraryEntryRead
from app.services.library import LibraryService


class BacklogService:
    """Manages user's personal backlog queue and priority sequencing."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.library_service = LibraryService(session)

    async def get_backlog_summary(
        self,
        status_filter: Optional[str] = None,
        ownership_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> BacklogSummaryResponse:
        """Retrieves ordered backlog queue and identifies the current Up Next title."""
        stmt = (
            select(LibraryEntry)
            .join(Game, LibraryEntry.game_id == Game.id)
            .options(
                selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )

        if status_filter and status_filter.lower() != "all":
            stmt = stmt.where(LibraryEntry.playing_status == status_filter)
        else:
            stmt = stmt.where(LibraryEntry.playing_status == PlayingStatus.PLANNED.value)

        if ownership_filter and ownership_filter.lower() != "all":
            stmt = stmt.where(LibraryEntry.ownership_status == ownership_filter)
        elif not ownership_filter or ownership_filter.lower() == "all":
            stmt = stmt.where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)

        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(Game.title.ilike(term))

        stmt = stmt.order_by(LibraryEntry.queue_position.asc(), LibraryEntry.priority.desc(), LibraryEntry.created_at.asc())
        result = await self.session.execute(stmt)
        entries = list(result.scalars().all())

        formatted = [self.library_service.format_entry_response(e) for e in entries]
        up_next = formatted[0] if formatted else None

        return BacklogSummaryResponse(
            total_planned=len(formatted),
            up_next=up_next,
            queue=formatted,
        )

    async def reorder_queue(self, items: List[BacklogReorderItem]) -> BacklogSummaryResponse:
        """Transactionally updates queue positions for provided entries."""
        for item in items:
            await self.session.execute(
                update(LibraryEntry)
                .where(LibraryEntry.id == item.entry_id)
                .values(queue_position=item.queue_position)
            )
        await self.session.commit()
        return await self.get_backlog_summary()

    async def move_item(self, entry_id: str, direction: str) -> BacklogSummaryResponse:
        """Controller-friendly 1-step move up or down in backlog queue."""
        stmt = (
            select(LibraryEntry)
            .where(LibraryEntry.playing_status == PlayingStatus.PLANNED.value)
            .order_by(LibraryEntry.queue_position.asc(), LibraryEntry.created_at.asc())
        )
        res = await self.session.execute(stmt)
        entries = list(res.scalars().all())

        idx = next((i for i, e in enumerate(entries) if e.id == entry_id), None)
        if idx is None:
            raise EntityNotFoundException("LibraryEntry", entry_id)

        target_idx = idx - 1 if direction == "up" else idx + 1
        if 0 <= target_idx < len(entries):
            # Swap queue positions
            curr = entries[idx]
            other = entries[target_idx]
            pos_curr = curr.queue_position or (idx + 1)
            pos_other = other.queue_position or (target_idx + 1)
            if pos_curr == pos_other:
                pos_curr, pos_other = idx + 1, target_idx + 1

            curr.queue_position = pos_other
            other.queue_position = pos_curr
            await self.session.commit()

        return await self.get_backlog_summary()

    async def set_as_next(self, entry_id: str) -> BacklogSummaryResponse:
        """Sets entry as #1 Up Next in queue and shifts other entries down."""
        target = await self.session.get(LibraryEntry, entry_id)
        if not target:
            raise EntityNotFoundException("LibraryEntry", entry_id)

        stmt = (
            select(LibraryEntry)
            .where(
                LibraryEntry.playing_status == PlayingStatus.PLANNED.value,
                LibraryEntry.id != entry_id,
            )
            .order_by(LibraryEntry.queue_position.asc(), LibraryEntry.created_at.asc())
        )
        res = await self.session.execute(stmt)
        other_entries = list(res.scalars().all())

        target.queue_position = 1
        for i, other in enumerate(other_entries, start=2):
            other.queue_position = i

        await self.session.commit()
        return await self.get_backlog_summary()
