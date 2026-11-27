"""Gaming statistics and analytics calculation engine."""
import datetime
from collections import defaultdict
from typing import Any, Dict, List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.collection import WishlistItem
from app.models.game import Franchise, Game, Genre, game_genres
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus
from app.models.session import PlaySession
from app.schemas.stats import (
    FranchiseProgressItem,
    GamingStatsResponse,
    GenreStatsItem,
    HeatmapDayItem,
    MonthlyActivityItem,
    MostPlayedGameItem,
    PlatformStatsItem,
)


class StatsService:
    """Computes honest gaming analytics strictly from user's persistent SQLite database."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_analytics(
        self,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None,
    ) -> GamingStatsResponse:
        """Aggregates multi-dimensional stats without double-counting cumulative playtime."""
        # 1. Status breakdown (excludes unowned wishlist games)
        stmt = (
            select(LibraryEntry.playing_status, func.count(LibraryEntry.id))
            .where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
            .group_by(LibraryEntry.playing_status)
        )
        res = await self.session.execute(stmt)
        status_map = {row[0]: row[1] for row in res.all()}

        total_games = sum(status_map.values())
        playing = status_map.get(PlayingStatus.CURRENTLY_PLAYING.value, 0)
        planned = status_map.get(PlayingStatus.PLANNED.value, 0)
        completed = status_map.get(PlayingStatus.COMPLETED.value, 0)
        one_hundred = status_map.get(PlayingStatus.ONE_HUNDRED_PERCENT.value, 0)
        on_hold = status_map.get(PlayingStatus.ON_HOLD.value, 0)
        dropped = status_map.get(PlayingStatus.DROPPED.value, 0)

        # Wishlist count (dedicated Wishlist items + unowned "To Buy" entries)
        wishlist_res = await self.session.execute(select(func.count(WishlistItem.id)))
        dedicated_wishlist_count = wishlist_res.scalar_one() or 0
        legacy_wishlist_res = await self.session.execute(
            select(func.count(LibraryEntry.id)).where(
                LibraryEntry.ownership_status == OwnershipStatus.TO_BUY.value
            )
        )
        legacy_wishlist_count = legacy_wishlist_res.scalar_one() or 0
        wishlist_count = dedicated_wishlist_count + legacy_wishlist_count

        # Cumulative hours and average rating
        metrics_stmt = select(
            func.coalesce(func.sum(LibraryEntry.hours_played), 0.0),
            func.avg(LibraryEntry.personal_rating),
        ).where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
        metrics_res = await self.session.execute(metrics_stmt)
        m_row = metrics_res.one()
        total_hours = round(float(m_row[0]), 1)
        avg_rating = round(float(m_row[1]), 1) if m_row[1] is not None else None

        backlog_comp_pct = round(((completed + one_hundred) / total_games * 100.0), 1) if total_games > 0 else 0.0

        # 2. Most Played Games (Top 10)
        most_played_stmt = (
            select(LibraryEntry)
            .join(Game, LibraryEntry.game_id == Game.id)
            .where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
            .options(
                selectinload(LibraryEntry.game).selectinload(Game.artworks)
            )
            .order_by(LibraryEntry.hours_played.desc())
            .limit(10)
        )
        mp_res = await self.session.execute(most_played_stmt)
        most_played_games: List[MostPlayedGameItem] = []
        for e in mp_res.scalars().all():
            cover_art = next((a for a in e.game.artworks if a.asset_type == "cover" and a.is_active), None)
            most_played_games.append(
                MostPlayedGameItem(
                    entry_id=e.id,
                    title=e.game.title,
                    hours_played=round(e.hours_played, 1),
                    personal_rating=e.personal_rating,
                    cover_url=f"/api/v1/artwork/cache/{cover_art.asset_type}s/{cover_art.sha256_hash}.png" if cover_art and cover_art.sha256_hash else (cover_art.remote_url if cover_art else None),
                    platform=e.platform,
                    playing_status=e.playing_status,
                )
            )

        # 3. Platform Distribution
        plat_stmt = (
            select(
                LibraryEntry.platform,
                func.count(LibraryEntry.id),
                func.coalesce(func.sum(LibraryEntry.hours_played), 0.0),
            )
            .where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
            .group_by(LibraryEntry.platform)
            .order_by(func.count(LibraryEntry.id).desc())
        )
        plat_res = await self.session.execute(plat_stmt)
        platform_dist = [
            PlatformStatsItem(platform=row[0], game_count=row[1], hours_played=round(float(row[2]), 1))
            for row in plat_res.all()
        ]

        # 4. Hours by Genre (without double-counting total library hours)
        genre_stmt = (
            select(
                Genre.name,
                func.coalesce(func.sum(LibraryEntry.hours_played), 0.0),
                func.count(LibraryEntry.id),
            )
            .join(game_genres, Genre.id == game_genres.c.genre_id)
            .join(Game, game_genres.c.game_id == Game.id)
            .join(LibraryEntry, Game.id == LibraryEntry.game_id)
            .where(LibraryEntry.ownership_status != OwnershipStatus.TO_BUY.value)
            .group_by(Genre.name)
            .order_by(func.sum(LibraryEntry.hours_played).desc())
            .limit(10)
        )
        genre_res = await self.session.execute(genre_stmt)
        genre_stats = [
            GenreStatsItem(genre=row[0], hours_played=round(float(row[1]), 1), game_count=row[2])
            for row in genre_res.all()
        ]

        # 5. Play Session History (Monthly activity and Heatmap)
        sess_stmt = select(PlaySession).order_by(PlaySession.session_date.asc())
        if start_date:
            sess_stmt = sess_stmt.where(PlaySession.session_date >= datetime.datetime.combine(start_date, datetime.time.min))
        if end_date:
            sess_stmt = sess_stmt.where(PlaySession.session_date <= datetime.datetime.combine(end_date, datetime.time.max))

        sess_res = await self.session.execute(sess_stmt)
        all_sessions = sess_res.scalars().all()

        monthly_buckets: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"minutes": 0, "sessions": 0, "completed": 0})
        daily_heatmap: Dict[str, Dict[str, int]] = defaultdict(lambda: {"minutes": 0, "sessions": 0})
        yearly_summary: Dict[str, Dict[str, float]] = defaultdict(lambda: {"hours": 0.0, "sessions": 0, "completed": 0})

        for s in all_sessions:
            d = s.session_date.date() if isinstance(s.session_date, datetime.datetime) else s.session_date
            month_key = d.strftime("%Y-%m")
            day_key = d.strftime("%Y-%m-%d")
            year_key = d.strftime("%Y")

            monthly_buckets[month_key]["minutes"] += s.duration_minutes
            monthly_buckets[month_key]["sessions"] += 1

            daily_heatmap[day_key]["minutes"] += s.duration_minutes
            daily_heatmap[day_key]["sessions"] += 1

            yearly_summary[year_key]["hours"] = round(yearly_summary[year_key]["hours"] + (s.duration_minutes / 60.0), 1)
            yearly_summary[year_key]["sessions"] += 1

        monthly_activity = [
            MonthlyActivityItem(
                month=m,
                hours_played=round(data["minutes"] / 60.0, 1),
                sessions_count=data["sessions"],
                completed_count=data["completed"],
            )
            for m, data in sorted(monthly_buckets.items())
        ]

        heatmap = [
            HeatmapDayItem(date=d, minutes=data["minutes"], session_count=data["sessions"])
            for d, data in sorted(daily_heatmap.items())
        ]

        # 6. Franchise Completion Progress
        fran_stmt = (
            select(Franchise)
            .options(
                selectinload(Franchise.games).selectinload(Game.library_entry)
            )
            .order_by(Franchise.name.asc())
        )
        fran_res = await self.session.execute(fran_stmt)
        franchise_progress: List[FranchiseProgressItem] = []
        for f in fran_res.scalars().all():
            owned_games = [g for g in f.games if g.library_entry is not None]
            if not owned_games:
                continue
            f_comp = sum(1 for g in owned_games if g.library_entry.playing_status in ("Completed", "100% Completed"))
            f_hours = sum(g.library_entry.hours_played for g in owned_games)
            pct = round((f_comp / len(owned_games) * 100.0), 1)
            franchise_progress.append(
                FranchiseProgressItem(
                    franchise_name=f.name,
                    total_games=len(owned_games),
                    completed_games=f_comp,
                    completion_pct=pct,
                    total_hours=round(f_hours, 1),
                )
            )

        return GamingStatsResponse(
            total_games=total_games,
            currently_playing=playing,
            planned=planned,
            completed=completed,
            one_hundred_percent=one_hundred,
            on_hold=on_hold,
            dropped=dropped,
            wishlist_count=wishlist_count,
            total_hours_logged=total_hours,
            average_personal_rating=avg_rating,
            backlog_completion_pct=backlog_comp_pct,
            monthly_activity=monthly_activity,
            hours_by_genre=genre_stats,
            platform_distribution=platform_dist,
            most_played_games=most_played_games,
            franchise_progress=franchise_progress,
            heatmap=heatmap,
            yearly_summary=dict(yearly_summary),
        )
