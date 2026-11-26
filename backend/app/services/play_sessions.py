"""Play session tracking service managing live timers, crash recovery, and history."""
import datetime
from typing import List, Optional
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import EntityNotFoundException, ValidationException
from app.models.game import Game
from app.models.library import LibraryEntry
from app.models.session import ActivePlaySession, PlaySession
from app.schemas.session import (
    ActiveSessionEndRequest,
    ActiveSessionRead,
    ActiveSessionStart,
    PlaySessionCreate,
    PlaySessionRead,
    PlaySessionUpdate,
)
from app.services.library import LibraryService


class PlaySessionService:
    """Manages active live sessions, crash recovery, and recorded session history."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.library_service = LibraryService(session)

    def _format_active(self, act: ActivePlaySession) -> ActiveSessionRead:
        now = datetime.datetime.now(datetime.timezone.utc)
        elapsed = act.accumulated_seconds
        if not act.is_paused:
            leg_start = act.start_time
            if leg_start.tzinfo is None:
                leg_start = leg_start.replace(tzinfo=datetime.timezone.utc)
            elapsed += int(max(0, (now - leg_start).total_seconds()))

        entry_read = self.library_service.format_entry_response(act.library_entry) if act.library_entry else None
        return ActiveSessionRead(
            id=act.id,
            library_entry_id=act.library_entry_id,
            start_time=act.start_time,
            paused_at=act.paused_at,
            accumulated_seconds=act.accumulated_seconds,
            location_or_chapter=act.location_or_chapter,
            notes=act.notes,
            is_paused=act.is_paused,
            created_at=act.created_at,
            updated_at=act.updated_at,
            elapsed_seconds=elapsed,
            library_entry=entry_read,
        )

    def _format_history(self, sess: PlaySession) -> PlaySessionRead:
        entry_read = self.library_service.format_entry_response(sess.library_entry) if sess.library_entry else None
        return PlaySessionRead(
            id=sess.id,
            library_entry_id=sess.library_entry_id,
            session_date=sess.session_date,
            duration_minutes=sess.duration_minutes,
            location_or_chapter=sess.location_or_chapter,
            notes=sess.notes,
            created_at=sess.created_at,
            library_entry=entry_read,
        )

    async def get_active_session(self) -> Optional[ActiveSessionRead]:
        """Returns the currently active or paused session for live timers or restart recovery."""
        stmt = (
            select(ActivePlaySession)
            .options(
                selectinload(ActivePlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(ActivePlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(ActivePlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(ActivePlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        res = await self.session.execute(stmt)
        act = res.scalar_one_or_none()
        return self._format_active(act) if act else None

    async def start_session(self, payload: ActiveSessionStart) -> ActiveSessionRead:
        """Starts a live tracked session, replacing or ending any un-finalized session."""
        entry = await self.session.get(LibraryEntry, payload.library_entry_id)
        if not entry:
            raise EntityNotFoundException("LibraryEntry", payload.library_entry_id)

        # Clear existing active session if any
        await self.session.execute(delete(ActivePlaySession))

        now = datetime.datetime.now(datetime.timezone.utc)
        act = ActivePlaySession(
            library_entry_id=payload.library_entry_id,
            start_time=now,
            accumulated_seconds=0,
            location_or_chapter=payload.location_or_chapter,
            notes=payload.notes,
            is_paused=False,
        )
        self.session.add(act)
        await self.session.commit()
        await self.session.refresh(act)
        return await self.get_active_session()

    async def pause_session(self) -> Optional[ActiveSessionRead]:
        """Pauses the live timer and accumulates elapsed seconds."""
        res = await self.session.execute(select(ActivePlaySession))
        act = res.scalar_one_or_none()
        if not act or act.is_paused:
            return await self.get_active_session()

        now = datetime.datetime.now(datetime.timezone.utc)
        leg_start = act.start_time
        if leg_start.tzinfo is None:
            leg_start = leg_start.replace(tzinfo=datetime.timezone.utc)

        delta = int(max(0, (now - leg_start).total_seconds()))
        act.accumulated_seconds += delta
        act.is_paused = True
        act.paused_at = now
        await self.session.commit()
        return await self.get_active_session()

    async def resume_session(self) -> Optional[ActiveSessionRead]:
        """Resumes a paused session timer."""
        res = await self.session.execute(select(ActivePlaySession))
        act = res.scalar_one_or_none()
        if not act or not act.is_paused:
            return await self.get_active_session()

        now = datetime.datetime.now(datetime.timezone.utc)
        act.is_paused = False
        act.paused_at = None
        act.start_time = now
        await self.session.commit()
        return await self.get_active_session()

    async def end_session(self, payload: ActiveSessionEndRequest) -> PlaySessionRead:
        """Finalizes the active session, calculates playtime, and updates library entry hours."""
        res = await self.session.execute(select(ActivePlaySession))
        act = res.scalar_one_or_none()
        if not act:
            raise ValidationException("No active play session to complete.")

        now = datetime.datetime.now(datetime.timezone.utc)
        total_seconds = act.accumulated_seconds
        if not act.is_paused:
            leg_start = act.start_time
            if leg_start.tzinfo is None:
                leg_start = leg_start.replace(tzinfo=datetime.timezone.utc)
            total_seconds += int(max(0, (now - leg_start).total_seconds()))

        dur_minutes = max(1, round(total_seconds / 60))

        # Record in play_sessions
        combined_notes = payload.notes or act.notes
        chapter = payload.location_or_chapter or act.location_or_chapter
        play_sess = PlaySession(
            library_entry_id=act.library_entry_id,
            session_date=now,
            duration_minutes=dur_minutes,
            location_or_chapter=chapter,
            notes=combined_notes,
        )
        self.session.add(play_sess)

        # Update entry
        entry = await self.session.get(LibraryEntry, act.library_entry_id)
        if entry:
            entry.hours_played = round(entry.hours_played + (dur_minutes / 60.0), 2)
            if payload.progress_pct is not None:
                entry.progress_pct = payload.progress_pct

        # Delete active record
        await self.session.delete(act)
        await self.session.commit()
        await self.session.refresh(play_sess)

        # Load relation
        loaded = await self.session.execute(
            select(PlaySession)
            .where(PlaySession.id == play_sess.id)
            .options(
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        return self._format_history(loaded.scalar_one())

    async def discard_active_session(self) -> bool:
        """Discards active session state without saving playtime."""
        await self.session.execute(delete(ActivePlaySession))
        await self.session.commit()
        return True

    async def log_manual_session(self, payload: PlaySessionCreate) -> PlaySessionRead:
        """Logs a completed session manually and increments cumulative library hours."""
        entry = await self.session.get(LibraryEntry, payload.library_entry_id)
        if not entry:
            raise EntityNotFoundException("LibraryEntry", payload.library_entry_id)

        play_sess = PlaySession(
            library_entry_id=payload.library_entry_id,
            session_date=payload.session_date or datetime.datetime.now(datetime.timezone.utc),
            duration_minutes=payload.duration_minutes,
            location_or_chapter=payload.location_or_chapter,
            notes=payload.notes,
        )
        self.session.add(play_sess)
        entry.hours_played = round(entry.hours_played + (payload.duration_minutes / 60.0), 2)
        await self.session.commit()
        await self.session.refresh(play_sess)

        loaded = await self.session.execute(
            select(PlaySession)
            .where(PlaySession.id == play_sess.id)
            .options(
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        return self._format_history(loaded.scalar_one())

    async def list_history(
        self,
        entry_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[PlaySessionRead]:
        """Lists historical play sessions sorted chronologically."""
        stmt = (
            select(PlaySession)
            .options(
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
            .order_by(desc(PlaySession.session_date))
            .offset(offset)
            .limit(limit)
        )
        if entry_id:
            stmt = stmt.where(PlaySession.library_entry_id == entry_id)

        res = await self.session.execute(stmt)
        return [self._format_history(s) for s in res.scalars().all()]

    async def update_history(self, session_id: str, payload: PlaySessionUpdate) -> PlaySessionRead:
        """Edits recorded play session and adjusts cumulative library hours."""
        sess = await self.session.get(PlaySession, session_id)
        if not sess:
            raise EntityNotFoundException("PlaySession", session_id)

        data = payload.model_dump(exclude_unset=True)
        old_dur = sess.duration_minutes
        new_dur = data.get("duration_minutes", old_dur)

        for k, v in data.items():
            setattr(sess, k, v)

        if new_dur != old_dur:
            entry = await self.session.get(LibraryEntry, sess.library_entry_id)
            if entry:
                entry.hours_played = max(0.0, round(entry.hours_played + ((new_dur - old_dur) / 60.0), 2))

        await self.session.commit()
        await self.session.refresh(sess)

        loaded = await self.session.execute(
            select(PlaySession)
            .where(PlaySession.id == sess.id)
            .options(
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        return self._format_history(loaded.scalar_one())

    async def delete_history(self, session_id: str) -> bool:
        """Deletes a play session record and decrements logged game hours."""
        sess = await self.session.get(PlaySession, session_id)
        if not sess:
            return False

        dur = sess.duration_minutes
        entry = await self.session.get(LibraryEntry, sess.library_entry_id)
        if entry:
            entry.hours_played = max(0.0, round(entry.hours_played - (dur / 60.0), 2))

        await self.session.delete(sess)
        await self.session.commit()
        return True
