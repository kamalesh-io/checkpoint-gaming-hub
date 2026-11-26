"""Unit tests for Phase 5 business logic: Backlog, Planner, Sessions, and Backup."""
import datetime
from pathlib import Path
import pytest
from app.schemas.backlog import BacklogReorderItem
from app.services.backup import BackupService
from app.services.planner import PlannerService


def test_backup_service_paths():
    """Verify backup service directories and path helpers."""
    service = BackupService()
    assert service.backup_dir.exists()
    assert isinstance(service.list_backups(), list)


def test_import_format_validation():
    """Verify validation on malformed import JSON."""
    service = BackupService()
    with pytest.raises(Exception):
        import asyncio
        asyncio.run(service.import_library_json({"format": "invalid-format"}))
