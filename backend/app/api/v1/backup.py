"""Database Backup, Restore, and Import/Export API Router."""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.backup import (
    BackupCreateResponse,
    BackupFileItem,
    LibraryImportResult,
    RestoreRequest,
    RestoreResponse,
)
from app.services.backup import BackupService

router = APIRouter(prefix="/system/backup", tags=["Database Backup & Restore"])


@router.post("", response_model=BackupCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_backup():
    """Creates a verified online WAL-safe SQLite snapshot."""
    service = BackupService()
    return service.create_sqlite_backup()


@router.get("/list", response_model=List[BackupFileItem])
async def list_backups():
    """Lists existing SQLite snapshots."""
    service = BackupService()
    return service.list_backups()


@router.post("/restore", response_model=RestoreResponse)
async def restore_database(payload: RestoreRequest):
    """Restores database from specified backup with automated safety snapshot of current data."""
    service = BackupService()
    return service.restore_sqlite_backup(payload.filename, payload.confirm)


@router.get("/export-json")
async def export_library_json(db: AsyncSession = Depends(get_db)):
    """Exports portable JSON library without credentials or tokens."""
    service = BackupService(db)
    return await service.export_library_json()


@router.post("/import-json", response_model=LibraryImportResult)
async def import_library_json(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Imports portable JSON library dump, gracefully skipping duplicates."""
    service = BackupService(db)
    return await service.import_library_json(payload)


@router.post("/clear-cache")
async def clear_artwork_cache():
    """Clears local disk artwork cache without deleting library metadata or user progress."""
    service = BackupService()
    return service.clear_artwork_cache()
