"""Collections and Franchise organization service."""
import datetime
import uuid
from typing import List, Optional
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import EntityNotFoundException, ValidationException
from app.models.collection import Collection, CollectionItem
from app.models.game import Franchise, Game
from app.models.library import LibraryEntry, PlayingStatus
from app.schemas.collection import (
    CollectionCreate,
    CollectionItemAdd,
    CollectionItemRead,
    CollectionRead,
    CollectionReorderRequest,
    CollectionUpdate,
    FranchiseGameItem,
    FranchiseOrderUpdateRequest,
    FranchiseRead,
)
from app.services.library import LibraryService


class CollectionService:
    """Manages user custom playlists/collections and franchise groupings."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.library_service = LibraryService(session)

    def _format_collection(self, col: Collection) -> CollectionRead:
        items_read: List[CollectionItemRead] = []
        total_hours = 0.0
        completed = 0

        for item in sorted(col.items, key=lambda x: x.display_order):
            if item.library_entry:
                entry_read = self.library_service.format_entry_response(item.library_entry)
                items_read.append(
                    CollectionItemRead(
                        collection_id=item.collection_id,
                        library_entry_id=item.library_entry_id,
                        display_order=item.display_order,
                        library_entry=entry_read,
                    )
                )
                total_hours += item.library_entry.hours_played
                if item.library_entry.playing_status in (
                    PlayingStatus.COMPLETED.value,
                    PlayingStatus.ONE_HUNDRED_PERCENT.value,
                ):
                    completed += 1

        return CollectionRead(
            id=col.id,
            name=col.name,
            description=col.description,
            banner_url=col.banner_url,
            display_order=col.display_order,
            is_pinned=col.is_pinned,
            created_at=col.created_at,
            updated_at=col.updated_at,
            game_count=len(items_read),
            completed_count=completed,
            total_hours=round(total_hours, 1),
            items=items_read,
        )

    async def list_collections(self) -> List[CollectionRead]:
        """Lists user collections with loaded games and computed statistics."""
        stmt = (
            select(Collection)
            .options(
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.artworks),
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.genres),
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.themes),
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.franchise),
            )
            .order_by(Collection.is_pinned.desc(), Collection.display_order.asc(), Collection.name.asc())
        )
        res = await self.session.execute(stmt)
        return [self._format_collection(c) for c in res.scalars().all()]

    async def create_collection(self, payload: CollectionCreate) -> CollectionRead:
        """Creates a new collection."""
        col = Collection(
            name=payload.name,
            description=payload.description,
            banner_url=payload.banner_url,
            display_order=payload.display_order,
            is_pinned=payload.is_pinned,
        )
        self.session.add(col)
        await self.session.commit()
        await self.session.refresh(col)
        return await self.get_collection(col.id)

    async def get_collection(self, collection_id: str) -> CollectionRead:
        """Retrieves collection with full items."""
        stmt = (
            select(Collection)
            .where(Collection.id == collection_id)
            .options(
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.artworks),
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.genres),
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.themes),
                selectinload(Collection.items)
                .selectinload(CollectionItem.library_entry)
                .selectinload(LibraryEntry.game)
                .selectinload(Game.franchise),
            )
        )
        res = await self.session.execute(stmt)
        col = res.scalar_one_or_none()
        if not col:
            raise EntityNotFoundException("Collection", collection_id)
        return self._format_collection(col)

    async def update_collection(self, collection_id: str, updates: CollectionUpdate) -> CollectionRead:
        """Updates collection metadata."""
        col = await self.session.get(Collection, collection_id)
        if not col:
            raise EntityNotFoundException("Collection", collection_id)

        for k, v in updates.model_dump(exclude_unset=True).items():
            setattr(col, k, v)

        await self.session.commit()
        return await self.get_collection(collection_id)

    async def delete_collection(self, collection_id: str) -> bool:
        """Deletes collection without removing any games from library."""
        col = await self.session.get(Collection, collection_id)
        if not col:
            return False
        await self.session.delete(col)
        await self.session.commit()
        return True

    async def add_item(self, collection_id: str, payload: CollectionItemAdd) -> CollectionRead:
        """Adds a game to collection."""
        col = await self.session.get(Collection, collection_id)
        if not col:
            raise EntityNotFoundException("Collection", collection_id)

        entry = await self.session.get(LibraryEntry, payload.library_entry_id)
        if not entry:
            raise EntityNotFoundException("LibraryEntry", payload.library_entry_id)

        existing = await self.session.get(CollectionItem, (collection_id, payload.library_entry_id))
        if not existing:
            order = payload.display_order
            if order is None:
                max_order = await self.session.execute(
                    select(func.coalesce(func.max(CollectionItem.display_order), 0)).where(
                        CollectionItem.collection_id == collection_id
                    )
                )
                order = max_order.scalar_one() + 1

            item = CollectionItem(
                collection_id=collection_id,
                library_entry_id=payload.library_entry_id,
                display_order=order,
            )
            self.session.add(item)
            await self.session.commit()
            self.session.expire_all()

        return await self.get_collection(collection_id)

    async def remove_item(self, collection_id: str, library_entry_id: str) -> CollectionRead:
        """Removes a game from collection without touching library entry."""
        item = await self.session.get(CollectionItem, (collection_id, library_entry_id))
        if item:
            await self.session.delete(item)
            await self.session.commit()
            self.session.expire_all()
        return await self.get_collection(collection_id)

    async def reorder_items(self, collection_id: str, payload: CollectionReorderRequest) -> CollectionRead:
        """Reorders games inside a collection."""
        for order, entry_id in enumerate(payload.entry_ids, start=1):
            item = await self.session.get(CollectionItem, (collection_id, entry_id))
            if item:
                item.display_order = order
        await self.session.commit()
        self.session.expire_all()
        return await self.get_collection(collection_id)

    # ---------------- Franchises ----------------

    async def list_franchises(self) -> List[FranchiseRead]:
        """Lists franchises and their constituent games in user's ecosystem."""
        stmt = (
            select(Franchise)
            .options(
                selectinload(Franchise.games).selectinload(Game.artworks),
                selectinload(Franchise.games).selectinload(Game.genres),
                selectinload(Franchise.games).selectinload(Game.library_entry),
            )
            .order_by(Franchise.name.asc())
        )
        res = await self.session.execute(stmt)
        franchises = res.scalars().all()

        output: List[FranchiseRead] = []
        for f in franchises:
            sorted_games = sorted(f.games, key=lambda g: (g.franchise_order or 0, g.release_date or datetime.date.min))
            owned = sum(1 for g in f.games if g.library_entry is not None)
            completed = sum(
                1 for g in f.games if g.library_entry and g.library_entry.playing_status in ("Completed", "100% Completed")
            )

            game_items: List[FranchiseGameItem] = []
            for g in sorted_games:
                entry_read = self.library_service.format_entry_response(g.library_entry) if g.library_entry else None
                game_items.append(
                    FranchiseGameItem(
                        game_id=g.id,
                        title=g.title,
                        release_date=g.release_date,
                        franchise_order=g.franchise_order or 0,
                        library_entry=entry_read,
                    )
                )

            output.append(
                FranchiseRead(
                    id=f.id,
                    name=f.name,
                    slug=f.slug,
                    description=f.description,
                    total_games=len(f.games),
                    owned_games=owned,
                    completed_games=completed,
                    games=game_items,
                )
            )
        return output

    async def update_franchise_order(self, franchise_id: str, payload: FranchiseOrderUpdateRequest) -> FranchiseRead:
        """Sets custom play order for games within a franchise."""
        for item in payload.items:
            game = await self.session.get(Game, item.game_id)
            if game and game.franchise_id == franchise_id:
                game.franchise_order = item.order
        await self.session.commit()

        franchises = await self.list_franchises()
        target = next((f for f in franchises if f.id == franchise_id), None)
        if not target:
            raise EntityNotFoundException("Franchise", franchise_id)
        return target

    async def assign_game_franchise(self, game_id: str, franchise_name: str, order: Optional[int] = 0) -> Game:
        """Manually associates or corrects a game's franchise."""
        game = await self.session.get(Game, game_id)
        if not game:
            raise EntityNotFoundException("Game", game_id)

        slug = franchise_name.lower().replace(" ", "-").replace("'", "")
        res = await self.session.execute(select(Franchise).where(Franchise.slug == slug))
        franchise = res.scalar_one_or_none()

        if not franchise:
            franchise = Franchise(name=franchise_name, slug=slug)
            self.session.add(franchise)
            await self.session.flush()

        game.franchise_id = franchise.id
        game.franchise_order = order or 0
        await self.session.commit()
        return game
