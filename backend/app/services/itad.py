"""IsThereAnyDeal API client and Wishlist price tracking service."""
import datetime
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.collection import WishlistItem
from app.models.game import Game
from app.schemas.steam import PriceInfoItem, WishlistPricesResponse


ITAD_API_BASE = "https://api.isthereanydeal.com"


class ITADService:
    """Fetches verified regional deals and pricing from IsThereAnyDeal API."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_wishlist_prices(self, refresh: bool = False) -> WishlistPricesResponse:
        """Retrieves prices for all wishlist items with India/INR regional preference."""
        api_key = settings.get_itad_api_key()

        # Query all wishlist items joined with Game
        result = await self.session.execute(
            select(WishlistItem, Game).join(Game, WishlistItem.game_id == Game.id)
        )
        pairs = result.all()

        if refresh and pairs:
            if api_key:
                await self._refresh_live_prices(pairs, api_key)
            else:
                await self._refresh_steam_prices(pairs)

        items: List[PriceInfoItem] = []
        deals_count = 0

        for item, game in pairs:
            is_deal = False
            if item.current_price is not None and item.target_price is not None:
                is_deal = item.current_price <= item.target_price
                if is_deal:
                    deals_count += 1

            items.append(
                PriceInfoItem(
                    game_id=game.id,
                    title=game.title,
                    current_price=item.current_price,
                    discount_percent=item.discount_percent,
                    historical_low_price=item.historical_low_price,
                    store_deal_name=item.store_deal_name,
                    deal_url=item.deal_url,
                    currency=item.currency or "INR",
                    is_deal_active=is_deal,
                    target_price=item.target_price,
                    price_updated_at=item.price_updated_at,
                )
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        return WishlistPricesResponse(
            has_api_key=bool(api_key),
            currency="INR",
            items=items,
            deals_meeting_target=deals_count,
            last_updated=now,
        )

    async def _refresh_live_prices(
        self, pairs: List[tuple[WishlistItem, Game]], api_key: str
    ) -> None:
        """Queries ITAD API for regional prices (country=IN)."""
        now = datetime.datetime.now(datetime.timezone.utc)

        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
            for item, game in pairs:
                try:
                    # 1. Lookup game plain/id on ITAD
                    lookup_url = f"{ITAD_API_BASE}/games/lookup/v1"
                    lookup_params = {"key": api_key}
                    if game.steam_app_id:
                        lookup_params["appid"] = game.steam_app_id
                    else:
                        lookup_params["title"] = game.title

                    lookup_res = await client.get(lookup_url, params=lookup_params)
                    if lookup_res.status_code != 200:
                        continue

                    lookup_data = lookup_res.json()
                    game_id = lookup_data.get("game", {}).get("id")
                    if not game_id:
                        continue

                    # 2. Query regional pricing for India (country=IN)
                    overview_url = f"{ITAD_API_BASE}/games/overview/v2"
                    overview_res = await client.post(
                        overview_url,
                        params={"key": api_key, "country": "IN"},
                        json=[game_id],
                    )

                    if overview_res.status_code == 200:
                        data = overview_res.json()
                        prices = data.get("prices", [])
                        if prices:
                            deal_info = prices[0]
                            cut = deal_info.get("cut", 0)
                            price = deal_info.get("price", {}).get("amount")
                            regular = deal_info.get("regular", {}).get("amount")
                            shop_name = deal_info.get("shop", {}).get("name", "Store")
                            deal_url = deal_info.get("url")
                            history_low = deal_info.get("lowest", {}).get("price", {}).get("amount")

                            item.current_price = price
                            item.discount_percent = int(cut)
                            item.historical_low_price = history_low
                            item.store_deal_name = shop_name
                            item.deal_url = deal_url
                            item.currency = "INR"
                            item.price_updated_at = now
                        elif game.steam_app_id:
                            await self._fetch_steam_store_price(client, item, game, now)

                except Exception as exc:
                    logger.debug(f"ITAD pricing check failed for '{game.title}': {exc}")
                    if game.steam_app_id:
                        await self._fetch_steam_store_price(client, item, game, now)

        await self.session.commit()

    async def _refresh_steam_prices(self, pairs: List[tuple[WishlistItem, Game]]) -> None:
        """Fetches official regional India pricing (INR) directly from Steam Store API for games with Steam AppIDs."""
        now = datetime.datetime.now(datetime.timezone.utc)
        async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
            for item, game in pairs:
                if game.steam_app_id:
                    await self._fetch_steam_store_price(client, item, game, now)
        await self.session.commit()

    async def _fetch_steam_store_price(
        self, client: httpx.AsyncClient, item: WishlistItem, game: Game, now: datetime.datetime
    ) -> None:
        """Queries Steam Store API for regional Indian Rupee (INR) pricing."""
        try:
            url = "https://store.steampowered.com/api/appdetails"
            res = await client.get(
                url,
                params={"appids": game.steam_app_id, "cc": "in", "filters": "price_overview"},
            )
            if res.status_code == 200:
                data = res.json()
                app_info = data.get(str(game.steam_app_id), {})
                if app_info.get("success") and app_info.get("data"):
                    po = app_info["data"].get("price_overview")
                    if po:
                        final_amount = round(po.get("final", 0) / 100.0, 2)
                        item.current_price = final_amount
                        item.discount_percent = int(po.get("discount_percent", 0))
                        item.currency = "INR"
                        item.store_deal_name = "Steam (India)"
                        item.deal_url = f"https://store.steampowered.com/app/{game.steam_app_id}/"
                        item.price_updated_at = now
                    elif app_info["data"].get("is_free"):
                        item.current_price = 0.0
                        item.discount_percent = 0
                        item.currency = "INR"
                        item.store_deal_name = "Steam (Free to Play)"
                        item.deal_url = f"https://store.steampowered.com/app/{game.steam_app_id}/"
                        item.price_updated_at = now
        except Exception as exc:
            logger.debug(f"Steam Store price lookup failed for '{game.title}': {exc}")
