"""SQLite online backup, restore with safety rollback, and JSON export/import service."""
import datetime
import json
import os
import shutil
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import ValidationException
from app.models.collection import Collection, CollectionItem, WishlistItem
from app.models.game import Franchise, Game, Genre, Theme
from app.models.library import LibraryEntry
from app.models.session import JournalEntry, PlaySession, ScheduledSession
from app.schemas.backup import (
    BackupCreateResponse,
    BackupFileItem,
    LibraryImportResult,
    RestoreResponse,
)


class BackupService:
    """Provides reliable WAL-safe SQLite backups, safety restores, and portable JSON export/import."""

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session
        self.backup_dir = settings.DATA_DIR / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def _get_live_sqlite_path(self) -> Path:
        """Resolves live SQLite database path."""
        url = settings.get_database_url()
        # Format: sqlite+aiosqlite:///path
        clean_path = url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        return Path(clean_path)

    def create_sqlite_backup(self, prefix: str = "checkpoint_backup") -> BackupCreateResponse:
        """Performs a WAL-safe online SQLite snapshot using sqlite3.Connection.backup()."""
        source_path = self._get_live_sqlite_path()
        if not source_path.exists():
            raise ValidationException(f"Database file does not exist at {source_path}")

        now = datetime.datetime.now(datetime.timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        filename = f"{prefix}_{timestamp_str}.db"
        dest_path = self.backup_dir / filename

        # Native SQLite online backup API
        src_conn = sqlite3.connect(str(source_path))
        dest_conn = sqlite3.connect(str(dest_path))
        try:
            with dest_conn:
                src_conn.backup(dest_conn, pages=100)
        finally:
            dest_conn.close()
            src_conn.close()

        size_bytes = dest_path.stat().st_size
        size_kb = round(size_bytes / 1024, 1)

        return BackupCreateResponse(
            status="success",
            backup_filename=filename,
            backup_path=str(dest_path),
            size_bytes=size_bytes,
            formatted_size=f"{size_kb} KB",
            timestamp=now,
        )

    def list_backups(self) -> List[BackupFileItem]:
        """Lists existing database snapshots in the backups directory."""
        if not self.backup_dir.exists():
            return []

        backups: List[BackupFileItem] = []
        for p in self.backup_dir.glob("*.db"):
            st = p.stat()
            dt = datetime.datetime.fromtimestamp(st.st_mtime, datetime.timezone.utc)
            kb = round(st.st_size / 1024, 1)
            backups.append(
                BackupFileItem(
                    filename=p.name,
                    created_at=dt,
                    size_bytes=st.st_size,
                    formatted_size=f"{kb} KB",
                    is_auto_safety="safety" in p.name.lower(),
                )
            )
        return sorted(backups, key=lambda b: b.created_at, reverse=True)

    def restore_sqlite_backup(self, filename: str, confirm: bool) -> RestoreResponse:
        """Validates backup and restores into live database after creating an automated safety snapshot."""
        if not confirm:
            raise ValidationException("Explicit user confirmation is required to restore database.")

        backup_file = self.backup_dir / filename
        if not backup_file.exists():
            raise ValidationException(f"Backup file '{filename}' was not found.")

        # Verify integrity of target backup file
        test_conn = sqlite3.connect(str(backup_file))
        try:
            cursor = test_conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            row = cursor.fetchone()
            if not row or row[0] != "ok":
                raise ValidationException("Corrupted backup file: failed SQLite integrity check.")
            cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='library_entries';")
            has_library = cursor.fetchone()[0] > 0
            if not has_library:
                raise ValidationException("Incompatible backup: missing library_entries table.")
        finally:
            test_conn.close()

        # Create automated safety backup of current live state first
        safety_resp = self.create_sqlite_backup(prefix="safety_backup_before_restore")

        # Perform online restore from backup file to live database file
        live_path = self._get_live_sqlite_path()
        backup_conn = sqlite3.connect(str(backup_file))
        live_conn = sqlite3.connect(str(live_path))
        try:
            with live_conn:
                backup_conn.backup(live_conn, pages=100)
        finally:
            live_conn.close()
            backup_conn.close()

        return RestoreResponse(
            status="success",
            restored_from=filename,
            safety_backup_created=safety_resp.backup_filename,
            message="Database successfully restored. A safety snapshot of prior data was preserved.",
        )

    # ---------------- Portable JSON Export & Import ----------------

    async def export_library_json(self) -> Dict[str, Any]:
        """Produces a portable JSON dump of personal library, sessions, journal, and wishlist. Excludes all secrets."""
        if not self.session:
            raise ValidationException("Database session required for JSON export.")

        now = datetime.datetime.now(datetime.timezone.utc)

        # 1. Games & Library Entries
        stmt = (
            select(LibraryEntry)
            .options(
                selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        lib_res = await self.session.execute(stmt)
        entries = lib_res.scalars().all()

        exported_games = []
        for e in entries:
            exported_games.append({
                "igdb_id": e.game.igdb_id,
                "title": e.game.title,
                "slug": e.game.slug,
                "summary": e.game.summary,
                "storyline": e.game.storyline,
                "developer": e.game.developer,
                "publisher": e.game.publisher,
                "release_date": str(e.game.release_date) if e.game.release_date else None,
                "igdb_rating": e.game.igdb_rating,
                "platform": e.platform,
                "playing_status": e.playing_status,
                "ownership_status": e.ownership_status,
                "priority": e.priority,
                "queue_position": e.queue_position,
                "progress_pct": e.progress_pct,
                "hours_played": e.hours_played,
                "personal_rating": e.personal_rating,
                "completion_goal": e.completion_goal,
                "planned_start_date": str(e.planned_start_date) if e.planned_start_date else None,
                "target_completion_date": str(e.target_completion_date) if e.target_completion_date else None,
                "custom_tags": e.custom_tags,
                "is_favorite": e.is_favorite,
                "notes": e.notes,
            })

        # 2. Play Sessions
        sess_res = await self.session.execute(select(PlaySession).options(selectinload(PlaySession.library_entry).selectinload(LibraryEntry.game)))
        exported_sessions = []
        for s in sess_res.scalars().all():
            if s.library_entry and s.library_entry.game:
                exported_sessions.append({
                    "game_igdb_id": s.library_entry.game.igdb_id,
                    "session_date": s.session_date.isoformat(),
                    "duration_minutes": s.duration_minutes,
                    "location_or_chapter": s.location_or_chapter,
                    "notes": s.notes,
                })

        # 3. Journal Entries
        jour_res = await self.session.execute(select(JournalEntry).options(selectinload(JournalEntry.library_entry).selectinload(LibraryEntry.game)))
        exported_journal = []
        for j in jour_res.scalars().all():
            exported_journal.append({
                "game_igdb_id": j.library_entry.game.igdb_id if j.library_entry and j.library_entry.game else None,
                "title": j.title,
                "content_markdown": j.content_markdown,
                "entry_date": j.entry_date.isoformat(),
                "entry_type": j.entry_type,
                "is_spoiler": j.is_spoiler,
                "personal_rating": j.personal_rating,
            })

        # 4. Wishlist
        wl_res = await self.session.execute(select(WishlistItem).options(selectinload(WishlistItem.game)))
        exported_wishlist = []
        for w in wl_res.scalars().all():
            exported_wishlist.append({
                "igdb_id": w.game.igdb_id,
                "title": w.game.title,
                "priority": w.priority,
                "target_price": w.target_price,
                "currency": w.currency,
                "store_preference": w.store_preference,
                "notes": w.notes,
            })

        return {
            "format": "checkpoint-portable-v1",
            "exported_at": now.isoformat(),
            "app_version": settings.APP_VERSION,
            "library_games": exported_games,
            "play_sessions": exported_sessions,
            "journal_entries": exported_journal,
            "wishlist": exported_wishlist,
        }

    async def import_library_json(self, data: Dict[str, Any]) -> LibraryImportResult:
        """Validates and imports portable library JSON without overwriting existing titles."""
        if not self.session:
            raise ValidationException("Database session required for JSON import.")

        if data.get("format") != "checkpoint-portable-v1":
            raise ValidationException("Unsupported or invalid import format. Expected 'checkpoint-portable-v1'.")

        result = LibraryImportResult(
            imported_games=0,
            skipped_duplicates=0,
            imported_sessions=0,
            imported_journals=0,
            imported_collections=0,
            imported_wishlist=0,
            errors=[],
        )

        games_map: Dict[int, str] = {}  # igdb_id -> library_entry_id

        # Import games
        for g in data.get("library_games", []):
            try:
                igdb_id = g.get("igdb_id")
                if not igdb_id:
                    continue

                # Check duplicate
                check_stmt = select(LibraryEntry).join(Game, LibraryEntry.game_id == Game.id).where(Game.igdb_id == igdb_id)
                check_res = await self.session.execute(check_stmt)
                existing = check_res.scalar_one_or_none()
                if existing:
                    games_map[igdb_id] = existing.id
                    result.skipped_duplicates += 1
                    continue

                # Find or create Game
                game_res = await self.session.execute(select(Game).where(Game.igdb_id == igdb_id))
                game = game_res.scalar_one_or_none()
                if not game:
                    game = Game(
                        igdb_id=igdb_id,
                        title=g.get("title", "Unknown"),
                        slug=g.get("slug") or f"game-{igdb_id}",
                        summary=g.get("summary"),
                        storyline=g.get("storyline"),
                        developer=g.get("developer"),
                        publisher=g.get("publisher"),
                        igdb_rating=g.get("igdb_rating"),
                    )
                    self.session.add(game)
                    await self.session.flush()

                # Create LibraryEntry
                entry = LibraryEntry(
                    game_id=game.id,
                    platform=g.get("platform", "Steam"),
                    playing_status=g.get("playing_status", "Planned"),
                    ownership_status=g.get("ownership_status", "Owned"),
                    priority=g.get("priority", "Medium"),
                    queue_position=g.get("queue_position", 0),
                    progress_pct=g.get("progress_pct", 0.0),
                    hours_played=g.get("hours_played", 0.0),
                    personal_rating=g.get("personal_rating"),
                    completion_goal=g.get("completion_goal", "Main Story"),
                    custom_tags=g.get("custom_tags", ""),
                    is_favorite=g.get("is_favorite", False),
                    notes=g.get("notes", ""),
                )
                self.session.add(entry)
                await self.session.flush()
                games_map[igdb_id] = entry.id
                result.imported_games += 1
            except Exception as exc:
                result.errors.append(f"Game '{g.get('title')}': {exc}")

        # Import play sessions
        for s in data.get("play_sessions", []):
            try:
                g_id = s.get("game_igdb_id")
                entry_id = games_map.get(g_id)
                if entry_id:
                    sess_dt = datetime.datetime.fromisoformat(s["session_date"]) if "session_date" in s else datetime.datetime.now(datetime.timezone.utc)
                    ps = PlaySession(
                        library_entry_id=entry_id,
                        session_date=sess_dt,
                        duration_minutes=s.get("duration_minutes", 30),
                        location_or_chapter=s.get("location_or_chapter"),
                        notes=s.get("notes"),
                    )
                    self.session.add(ps)
                    result.imported_sessions += 1
            except Exception as exc:
                result.errors.append(f"Play session error: {exc}")

        # Import journal entries
        for j in data.get("journal_entries", []):
            try:
                g_id = j.get("game_igdb_id")
                entry_id = games_map.get(g_id) if g_id else None
                jour_dt = datetime.datetime.fromisoformat(j["entry_date"]) if "entry_date" in j else datetime.datetime.now(datetime.timezone.utc)
                je = JournalEntry(
                    library_entry_id=entry_id,
                    title=j.get("title", "Untitled Note"),
                    content_markdown=j.get("content_markdown", ""),
                    entry_date=jour_dt,
                    entry_type=j.get("entry_type", "Note"),
                    is_spoiler=j.get("is_spoiler", False),
                    personal_rating=j.get("personal_rating"),
                )
                self.session.add(je)
                result.imported_journals += 1
            except Exception as exc:
                result.errors.append(f"Journal error: {exc}")

        await self.session.commit()
        return result

    def clear_artwork_cache(self) -> Dict[str, Any]:
        """Clears cached images in ARTWORK_CACHE_DIR without touching database records or metadata."""
        cache_dir = settings.ARTWORK_CACHE_DIR
        cleared_files = 0
        cleared_bytes = 0

        if cache_dir.exists():
            for root, _, files in os.walk(cache_dir):
                for f in files:
                    file_path = Path(root) / f
                    try:
                        cleared_bytes += file_path.stat().st_size
                        file_path.unlink()
                        cleared_files += 1
                    except Exception:
                        pass

        settings.ensure_directories()
        kb = round(cleared_bytes / 1024, 1)
        return {
            "status": "success",
            "cleared_files": cleared_files,
            "cleared_bytes": cleared_bytes,
            "formatted_size": f"{kb} KB",
        }
