"""SQLAlchemy models for Custom Collections and Wishlist."""
import datetime
import uuid
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class Collection(Base, TimestampMixin):
    """User-created playlist or group of games."""

    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    items: Mapped[List["CollectionItem"]] = relationship(
        "CollectionItem", back_populates="collection", cascade="all, delete-orphan", lazy="selectin"
    )


class CollectionItem(Base):
    """Junction table connecting library games to collections."""

    __tablename__ = "collection_items"

    collection_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )
    library_entry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("library_entries.id", ondelete="CASCADE"), primary_key=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    collection: Mapped["Collection"] = relationship("Collection", back_populates="items")
    library_entry: Mapped["LibraryEntry"] = relationship("LibraryEntry", back_populates="collection_items")


class WishlistItem(Base, TimestampMixin):
    """Tracked unowned games with purchase intent."""

    __tablename__ = "wishlist_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    priority: Mapped[str] = mapped_column(String(16), default="Medium", nullable=False)
    target_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)
    store_preference: Mapped[str] = mapped_column(String(32), default="Any", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ITAD Price Tracking (Phase 6F)
    current_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    historical_low_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    store_deal_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    deal_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    price_updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped["Game"] = relationship("Game")
