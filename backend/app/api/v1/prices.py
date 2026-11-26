"""API router for Wishlist price tracking and IsThereAnyDeal integrations."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.steam import WishlistPricesResponse
from app.services.itad import ITADService


router = APIRouter(prefix="/wishlist", tags=["Wishlist Pricing"])


@router.get("/prices", response_model=WishlistPricesResponse)
async def get_wishlist_prices(
    refresh: bool = Query(False, description="Fetch live price updates from IsThereAnyDeal"),
    db: AsyncSession = Depends(get_db),
) -> WishlistPricesResponse:
    """Retrieves current prices and deals for wishlist games with INR regional pricing."""
    service = ITADService(db)
    return await service.get_wishlist_prices(refresh=refresh)


@router.post("/prices/refresh", response_model=WishlistPricesResponse)
async def refresh_wishlist_prices(db: AsyncSession = Depends(get_db)) -> WishlistPricesResponse:
    """Forces price refresh from IsThereAnyDeal API."""
    service = ITADService(db)
    return await service.get_wishlist_prices(refresh=True)
