"""API v1 Router aggregation."""

from fastapi import APIRouter

from app.api.v1.artwork import router as artwork_router
from app.api.v1.backlog import router as backlog_router
from app.api.v1.backup import router as backup_router
from app.api.v1.collections import router as collections_router
from app.api.v1.franchises import router as franchises_router
from app.api.v1.journal import router as journal_router
from app.api.v1.launcher import router as launcher_router
from app.api.v1.library import router as library_router
from app.api.v1.planner import router as planner_router
from app.api.v1.prices import router as prices_router
from app.api.v1.search import router as search_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.settings import router as settings_router
from app.api.v1.stats import router as stats_router
from app.api.v1.steam import router as steam_router
from app.api.v1.system import router as system_router
from app.api.v1.wishlist import router as wishlist_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(system_router)
api_router.include_router(backup_router)
api_router.include_router(search_router)
api_router.include_router(library_router)
api_router.include_router(backlog_router)
api_router.include_router(planner_router)
api_router.include_router(sessions_router)
api_router.include_router(collections_router)
api_router.include_router(franchises_router)
api_router.include_router(journal_router)
api_router.include_router(stats_router)
api_router.include_router(wishlist_router)
api_router.include_router(settings_router)
api_router.include_router(artwork_router)
api_router.include_router(steam_router)
api_router.include_router(launcher_router)
api_router.include_router(prices_router)

