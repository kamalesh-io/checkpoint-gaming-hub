"""Pydantic schemas for Database Backup, Restore, and JSON Export/Import."""
import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BackupFileItem(BaseModel):
    filename: str
    created_at: datetime.datetime
    size_bytes: int
    formatted_size: str
    is_auto_safety: bool


class BackupCreateResponse(BaseModel):
    status: str
    backup_filename: str
    backup_path: str
    size_bytes: int
    formatted_size: str
    timestamp: datetime.datetime


class RestoreRequest(BaseModel):
    filename: str = Field(..., description="Name of the backup file in backups directory")
    confirm: bool = Field(..., description="Explicit user confirmation to overwrite database")


class RestoreResponse(BaseModel):
    status: str
    restored_from: str
    safety_backup_created: str
    message: str


class LibraryImportResult(BaseModel):
    imported_games: int
    skipped_duplicates: int
    imported_sessions: int
    imported_journals: int
    imported_collections: int
    imported_wishlist: int
    errors: List[str] = []
