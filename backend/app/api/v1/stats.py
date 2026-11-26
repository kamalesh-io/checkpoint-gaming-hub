"""Gaming Statistics API Router."""
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.stats import GamingStatsResponse
from app.services.stats import StatsService

router = APIRouter(prefix="/stats", tags=["Gaming Analytics & Statistics"])


@router.get("", response_model=GamingStatsResponse)
async def get_gaming_statistics(
    start: Optional[datetime.date] = Query(None, description="Optional start date filter"),
    end: Optional[datetime.date] = Query(None, description="Optional end date filter"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves computed personal gaming analytics, completion velocity, heatmap, and distributions."""
    service = StatsService(db)
    return await service.get_analytics(start_date=start, end_date=end)
