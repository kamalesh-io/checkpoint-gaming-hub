"""Gaming Planner & Calendar session management service."""
import datetime
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import EntityNotFoundException, ValidationException
from app.models.game import Game
from app.models.library import LibraryEntry
from app.models.session import PlaySession, ScheduledSession
from app.schemas.session import (
    ScheduledSessionCompleteRequest,
    ScheduledSessionCreate,
    ScheduledSessionRead,
    ScheduledSessionUpdate,
)
from app.services.library import LibraryService


class PlannerService:
    """Manages scheduled calendar sessions and conflict warnings."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.library_service = LibraryService(session)

    def _format_session(self, sess: ScheduledSession, conflict_warning: Optional[str] = None) -> ScheduledSessionRead:
        entry_read = self.library_service.format_entry_response(sess.library_entry) if sess.library_entry else None
        return ScheduledSessionRead(
            id=sess.id,
            library_entry_id=sess.library_entry_id,
            scheduled_start=sess.scheduled_start,
            duration_minutes=sess.duration_minutes,
            reminder_minutes_before=sess.reminder_minutes_before,
            repeat_schedule=sess.repeat_schedule,
            status=sess.status,
            notes=sess.notes,
            created_at=sess.created_at,
            updated_at=sess.updated_at,
            library_entry=entry_read,
            conflict_warning=conflict_warning,
        )

    async def check_conflicts(
        self,
        start_time: datetime.datetime,
        duration_minutes: int,
        exclude_id: Optional[str] = None,
    ) -> Optional[str]:
        """Detects if any active scheduled session overlaps with given window."""
        st = start_time if start_time.tzinfo else start_time.replace(tzinfo=datetime.timezone.utc)
        et = st + datetime.timedelta(minutes=duration_minutes)

        stmt = (
            select(ScheduledSession)
            .where(ScheduledSession.status.in_(["Scheduled", "In Progress"]))
            .options(
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game)
            )
        )
        if exclude_id:
            stmt = stmt.where(ScheduledSession.id != exclude_id)

        res = await self.session.execute(stmt)
        active_sessions = res.scalars().all()

        for s in active_sessions:
            s_start = s.scheduled_start if s.scheduled_start.tzinfo else s.scheduled_start.replace(tzinfo=datetime.timezone.utc)
            s_end = s_start + datetime.timedelta(minutes=s.duration_minutes)
            if st < s_end and et > s_start:
                game_title = s.library_entry.game.title if s.library_entry and s.library_entry.game else "another session"
                time_str = s_start.strftime("%b %d, %H:%M")
                return f"Overlaps with {game_title} scheduled for {time_str} ({s.duration_minutes}m)"
        return None

    async def list_sessions(
        self,
        start_date: Optional[datetime.datetime] = None,
        end_date: Optional[datetime.datetime] = None,
        status: Optional[str] = None,
    ) -> List[ScheduledSessionRead]:
        """Lists scheduled sessions with optional date filtering."""
        stmt = (
            select(ScheduledSession)
            .options(
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
            .order_by(ScheduledSession.scheduled_start.asc())
        )

        if start_date:
            stmt = stmt.where(ScheduledSession.scheduled_start >= start_date)
        if end_date:
            stmt = stmt.where(ScheduledSession.scheduled_start <= end_date)
        if status and status.lower() != "all":
            stmt = stmt.where(ScheduledSession.status == status)

        res = await self.session.execute(stmt)
        return [self._format_session(s) for s in res.scalars().all()]

    async def create_session(self, payload: ScheduledSessionCreate) -> ScheduledSessionRead:
        """Schedules a new gaming session with non-blocking conflict analysis."""
        entry = await self.session.get(LibraryEntry, payload.library_entry_id)
        if not entry:
            raise EntityNotFoundException("LibraryEntry", payload.library_entry_id)

        conflict = await self.check_conflicts(payload.scheduled_start, payload.duration_minutes)

        scheduled = ScheduledSession(
            library_entry_id=payload.library_entry_id,
            scheduled_start=payload.scheduled_start,
            duration_minutes=payload.duration_minutes,
            reminder_minutes_before=payload.reminder_minutes_before,
            repeat_schedule=payload.repeat_schedule,
            status=payload.status,
            notes=payload.notes,
        )
        self.session.add(scheduled)
        await self.session.commit()
        await self.session.refresh(scheduled)

        # Preload entry
        loaded = await self.session.execute(
            select(ScheduledSession)
            .where(ScheduledSession.id == scheduled.id)
            .options(
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        return self._format_session(loaded.scalar_one(), conflict_warning=conflict)

    async def update_session(self, session_id: str, updates: ScheduledSessionUpdate) -> ScheduledSessionRead:
        """Modifies schedule parameters and checks for new conflicts if time adjusted."""
        sess = await self.session.get(ScheduledSession, session_id)
        if not sess:
            raise EntityNotFoundException("ScheduledSession", session_id)

        data = updates.model_dump(exclude_unset=True)
        new_start = data.get("scheduled_start", sess.scheduled_start)
        new_dur = data.get("duration_minutes", sess.duration_minutes)
        conflict = await self.check_conflicts(new_start, new_dur, exclude_id=session_id)

        for k, v in data.items():
            setattr(sess, k, v)

        await self.session.commit()
        await self.session.refresh(sess)

        loaded = await self.session.execute(
            select(ScheduledSession)
            .where(ScheduledSession.id == sess.id)
            .options(
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        return self._format_session(loaded.scalar_one(), conflict_warning=conflict)

    async def complete_session(self, session_id: str, payload: ScheduledSessionCompleteRequest) -> ScheduledSessionRead:
        """Marks scheduled session completed and optionally logs playtime."""
        sess = await self.session.get(ScheduledSession, session_id)
        if not sess:
            raise EntityNotFoundException("ScheduledSession", session_id)

        sess.status = "Completed"
        if payload.notes:
            sess.notes = f"{sess.notes}\n{payload.notes}".strip() if sess.notes else payload.notes

        dur = payload.actual_duration_minutes or sess.duration_minutes

        if payload.log_as_play_session:
            play_sess = PlaySession(
                library_entry_id=sess.library_entry_id,
                session_date=sess.scheduled_start,
                duration_minutes=dur,
                notes=payload.notes or "Completed from scheduled session",
            )
            self.session.add(play_sess)

            # Update hours_played on entry
            entry = await self.session.get(LibraryEntry, sess.library_entry_id)
            if entry:
                entry.hours_played = round(entry.hours_played + (dur / 60.0), 2)

        await self.session.commit()
        await self.session.refresh(sess)

        loaded = await self.session.execute(
            select(ScheduledSession)
            .where(ScheduledSession.id == sess.id)
            .options(
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(ScheduledSession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        return self._format_session(loaded.scalar_one())

    async def delete_session(self, session_id: str) -> bool:
        """Deletes a scheduled session."""
        sess = await self.session.get(ScheduledSession, session_id)
        if not sess:
            return False
        await self.session.delete(sess)
        await self.session.commit()
        return True
