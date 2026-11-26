"""Pydantic schemas for Backlog Queue and Prioritization."""
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.library import LibraryEntryRead


class BacklogReorderItem(BaseModel):
    entry_id: str
    queue_position: int = Field(..., ge=1)


class BacklogReorderRequest(BaseModel):
    items: List[BacklogReorderItem] = Field(..., min_length=1)


class BacklogMoveRequest(BaseModel):
    direction: str = Field(..., pattern="^(up|down)$", description="Move item up or down by 1 position")


class BacklogSetNextRequest(BaseModel):
    entry_id: str = Field(..., description="Set this entry as #1 Up Next in backlog")


class BacklogSummaryResponse(BaseModel):
    total_planned: int
    up_next: Optional[LibraryEntryRead] = None
    queue: List[LibraryEntryRead]
