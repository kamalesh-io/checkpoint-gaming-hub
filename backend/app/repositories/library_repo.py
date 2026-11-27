"""Data access repository for personal Library Entries."""
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from app.models.artwork import GameArtwork
from app.models.game import Game, Genre, game_genres
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus


class LibraryRepository:
    """Repository handling CRUD, filtering, sorting, and stats for user library entries."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, entry_id: str) -> Optional[LibraryEntry]:
        """Retrieves a library entry by ID with full game and artwork relationships."""
        stmt = (
            select(LibraryEntry)
            .where(LibraryEntry.id == entry_id)
            .options(
                selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(LibraryEntry.game).selectinload(Game.franchise),
                selectinload(LibraryEntry.play_sessions),
                selectinload(LibraryEntry.journal_entries),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_game_id(self, game_id: str) -> Optional[LibraryEntry]:
        """Retrieves a library entry by internal Game ID."""
        stmt = select(LibraryEntry).where(LibraryEntry.game_id == game_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_igdb_id(self, igdb_id: int) -> Optional[LibraryEntry]:
        """Retrieves a library entry by IGDB ID."""
        stmt = (
            select(LibraryEntry)
            .join(Game, LibraryEntry.game_id == Game.id)
            .where(Game.igdb_id == igdb_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_entries(
        self,
        status: Optional[str] = None,
        ownership_status: Optional[str] = None,
        platform: Optional[str] = None,
        priority: Optional[str] = None,
        genre: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        search_text: Optional[str] = None,
        sort_by: str = "recently_played",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[LibraryEntry], int]:
        """Queries library entries with multi-filter, search, and sort."""
        base_query = select(LibraryEntry).join(Game, LibraryEntry.game_id == Game.id)

        # Filters
        if status and status.lower() != "all":
            base_query = base_query.where(LibraryEntry.playing_status == status)
        if ownership_status and ownership_status.lower() != "all":
            base_query = base_query.where(LibraryEntry.ownership_status == ownership_status)
        elif not ownership_status or ownership_status.lower() == "all":
            # Default library query decouples Wishlist: excludes "To Buy" entries unless explicitly queried
            base_query = base_query.where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
        if platform and platform.lower() != "all":
            base_query = base_query.where(LibraryEntry.platform == platform)
        if priority and priority.lower() != "all":
            base_query = base_query.where(LibraryEntry.priority == priority)
        if genre and genre.lower() != "all":
            base_query = base_query.where(Game.genres.any(Genre.name == genre))
        if is_favorite is not None:
            base_query = base_query.where(LibraryEntry.is_favorite == is_favorite)
        if search_text:
            term = f"%{search_text.strip()}%"
            base_query = base_query.where(
                or_(
                    Game.title.ilike(term),
                    LibraryEntry.custom_tags.ilike(term),
                    LibraryEntry.notes.ilike(term),
                )
            )

        # Total count
        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_res = await self.session.execute(count_stmt)
        total_count = total_res.scalar_one()

        # Sorting
        if sort_by == "title_asc":
            base_query = base_query.order_by(Game.title.asc())
        elif sort_by == "progress_desc":
            base_query = base_query.order_by(LibraryEntry.progress_pct.desc(), Game.title.asc())
        elif sort_by == "priority_desc":
            base_query = base_query.order_by(
                LibraryEntry.queue_position.asc(),
                LibraryEntry.priority.desc(),
                Game.title.asc(),
            )
        elif sort_by == "rating_desc":
            base_query = base_query.order_by(LibraryEntry.personal_rating.desc().nullslast())
        else:  # default: recently_played / updated
            base_query = base_query.order_by(LibraryEntry.updated_at.desc())

        # Pagination and relation preloading
        stmt = (
            base_query.offset(offset)
            .limit(limit)
            .options(
                selectinload(LibraryEntry.game).selectinload(Game.artworks),
                selectinload(LibraryEntry.game).selectinload(Game.genres),
                selectinload(LibraryEntry.game).selectinload(Game.themes),
                selectinload(LibraryEntry.game).selectinload(Game.franchise),
            )
        )
        result = await self.session.execute(stmt)
        entries = list(result.scalars().all())
        return entries, total_count

    async def create_entry(self, entry: LibraryEntry) -> LibraryEntry:
        """Persists a new LibraryEntry."""
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def update_entry(self, entry: LibraryEntry, updates: Dict[str, Any]) -> LibraryEntry:
        """Updates attributes on a LibraryEntry, allowing explicit clearing of nullable fields."""
        nullable_fields = {"personal_rating", "planned_start_date", "target_completion_date"}
        for key, value in updates.items():
            if hasattr(entry, key) and (value is not None or key in nullable_fields):
                setattr(entry, key, value)
        await self.session.flush()
        return entry

    async def delete_entry(self, entry_id: str) -> bool:
        """Deletes a library entry by ID."""
        stmt = delete(LibraryEntry).where(LibraryEntry.id == entry_id)
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def get_system_stats(self) -> Dict[str, Any]:
        """Computes summary statistics across user's library, excluding unowned wishlist entries."""
        # Total and completed
        total_stmt = select(func.count(LibraryEntry.id)).where(
            LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value
        )
        total_res = await self.session.execute(total_stmt)
        total_games = total_res.scalar_one()

        completed_stmt = select(func.count(LibraryEntry.id)).where(
            LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value,
            or_(
                LibraryEntry.playing_status == PlayingStatus.COMPLETED.value,
                LibraryEntry.playing_status == PlayingStatus.ONE_HUNDRED_PERCENT.value,
            ),
        )
        comp_res = await self.session.execute(completed_stmt)
        completed_games = comp_res.scalar_one()

        # Total hours
        hours_stmt = select(func.sum(LibraryEntry.hours_played)).where(
            LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value
        )
        hours_res = await self.session.execute(hours_stmt)
        total_hours = hours_res.scalar_one() or 0.0

        # Backlog count
        backlog_stmt = select(func.count(LibraryEntry.id)).where(
            LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value,
            LibraryEntry.playing_status == PlayingStatus.PLANNED.value,
        )
        backlog_res = await self.session.execute(backlog_stmt)
        backlog_count = backlog_res.scalar_one()

        # Games by platform
        plat_stmt = (
            select(LibraryEntry.platform, func.count(LibraryEntry.id))
            .where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
            .group_by(LibraryEntry.platform)
        )
        plat_res = await self.session.execute(plat_stmt)
        games_by_platform = {row[0]: row[1] for row in plat_res.all()}

        # Hours by genre
        genre_stmt = (
            select(Genre.name, func.sum(LibraryEntry.hours_played))
            .join(game_genres, Genre.id == game_genres.c.genre_id)
            .join(Game, game_genres.c.game_id == Game.id)
            .join(LibraryEntry, Game.id == LibraryEntry.game_id)
            .where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
            .group_by(Genre.name)
            .order_by(func.sum(LibraryEntry.hours_played).desc())
            .limit(5)
        )
        genre_res = await self.session.execute(genre_stmt)
        hours_by_genre = {row[0]: float(row[1] or 0.0) for row in genre_res.all()}

        return {
            "total_library_games": total_games,
            "completed_games": completed_games,
            "total_hours_logged": round(total_hours, 1),
            "backlog_count": backlog_count,
            "games_by_platform": games_by_platform,
            "hours_by_genre": hours_by_genre,
        }
