"""Data access repository for Games, Franchises, Genres, and Themes."""
import datetime
import json
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.game import Franchise, Game, Genre, Theme


class GameRepository:
    """Repository handling CRUD operations for Game entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, game_id: str) -> Optional[Game]:
        """Retrieves a Game by its internal UUID."""
        stmt = (
            select(Game)
            .where(Game.id == game_id)
            .options(
                selectinload(Game.genres),
                selectinload(Game.themes),
                selectinload(Game.franchise),
                selectinload(Game.artworks),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_igdb_id(self, igdb_id: int) -> Optional[Game]:
        """Retrieves a Game by its IGDB identifier."""
        stmt = (
            select(Game)
            .where(Game.igdb_id == igdb_id)
            .options(
                selectinload(Game.genres),
                selectinload(Game.themes),
                selectinload(Game.franchise),
                selectinload(Game.artworks),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Game]:
        """Retrieves a Game by its slug."""
        stmt = select(Game).where(Game.slug == slug)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_or_update_from_igdb(self, data: Dict[str, Any]) -> Game:
        """Upserts a Game entity from normalized IGDB metadata."""
        game = await self.get_by_igdb_id(data["igdb_id"])
        if not game:
            game = Game(
                igdb_id=data["igdb_id"],
                title=data["title"],
                slug=data["slug"],
                genres=[],
                themes=[],
            )
            self.session.add(game)

        # Update core fields
        game.title = data["title"]
        game.slug = data["slug"]
        game.summary = data.get("summary")
        game.storyline = data.get("storyline")
        game.release_date = data.get("release_date")
        game.developer = data.get("developer")
        game.publisher = data.get("publisher")
        game.igdb_rating = data.get("igdb_rating")
        game.game_type = data.get("game_type", "main_game")
        game.steam_app_id = data.get("steam_app_id")
        game.raw_metadata = json.dumps({
            "platforms": data.get("platforms", []),
            "igdb_rating_count": data.get("igdb_rating_count"),
        })

        # Handle Franchise
        if data.get("franchise_name"):
            f_slug = data.get("franchise_slug") or data["franchise_name"].lower().replace(" ", "-")
            stmt = select(Franchise).where(Franchise.name == data["franchise_name"])
            res = await self.session.execute(stmt)
            franchise = res.scalar_one_or_none()
            if not franchise:
                franchise = Franchise(name=data["franchise_name"], slug=f_slug)
                self.session.add(franchise)
                await self.session.flush()
            game.franchise_id = franchise.id

        # Handle Genres
        if data.get("genres"):
            genre_list = []
            for g in data["genres"]:
                if isinstance(g, str):
                    g_name = g
                    g_id = None
                    g_slug = g.lower().replace(" ", "-")
                else:
                    g_name = g.get("name", "Unknown")
                    g_id = g.get("id")
                    g_slug = g.get("slug")

                if g_id:
                    stmt = select(Genre).where(Genre.id == g_id)
                else:
                    stmt = select(Genre).where(Genre.name == g_name)

                res = await self.session.execute(stmt)
                genre = res.scalar_one_or_none()
                if not genre:
                    genre = Genre(id=g_id, name=g_name, slug=g_slug)
                    self.session.add(genre)
                    await self.session.flush()
                genre_list.append(genre)
            game.genres = genre_list

        # Handle Themes
        if data.get("themes"):
            theme_list = []
            for t in data["themes"]:
                if isinstance(t, str):
                    t_name = t
                    t_id = None
                    t_slug = t.lower().replace(" ", "-")
                else:
                    t_name = t.get("name", "Unknown")
                    t_id = t.get("id")
                    t_slug = t.get("slug")

                if t_id:
                    stmt = select(Theme).where(Theme.id == t_id)
                else:
                    stmt = select(Theme).where(Theme.name == t_name)

                res = await self.session.execute(stmt)
                theme = res.scalar_one_or_none()
                if not theme:
                    theme = Theme(id=t_id, name=t_name, slug=t_slug)
                    self.session.add(theme)
                    await self.session.flush()
                theme_list.append(theme)
            game.themes = theme_list

        await self.session.flush()
        return game
