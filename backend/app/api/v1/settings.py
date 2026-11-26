"""Application Settings key-value API Router."""
import json
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.models.settings import AppSetting

router = APIRouter(prefix="/settings", tags=["Application Settings"])


class SettingPayload(BaseModel):
    value: Any


class BatchSettingsPayload(BaseModel):
    settings: Dict[str, Any]


@router.get("", response_model=Dict[str, Any])
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Retrieves all persisted application settings."""
    res = await db.execute(select(AppSetting))
    output: Dict[str, Any] = {}
    for s in res.scalars().all():
        try:
            output[s.key] = json.loads(s.value_json)
        except Exception:
            output[s.key] = s.value_json
    return output


@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    """Retrieves a single application setting by key."""
    s = await db.get(AppSetting, key)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found.")
    try:
        return {"key": key, "value": json.loads(s.value_json)}
    except Exception:
        return {"key": key, "value": s.value_json}


@router.put("/{key}")
async def set_setting(
    key: str,
    payload: SettingPayload,
    db: AsyncSession = Depends(get_db),
):
    """Stores or updates an application setting."""
    s = await db.get(AppSetting, key)
    val_json = json.dumps(payload.value) if not isinstance(payload.value, str) else payload.value
    if s:
        s.value_json = val_json
    else:
        s = AppSetting(key=key, value_json=val_json)
        db.add(s)
    await db.commit()
    return {"status": "success", "key": key, "value": payload.value}


@router.post("/batch")
async def set_settings_batch(
    payload: BatchSettingsPayload,
    db: AsyncSession = Depends(get_db),
):
    """Updates multiple settings at once."""
    for key, val in payload.settings.items():
        val_json = json.dumps(val) if not isinstance(val, str) else val
        s = await db.get(AppSetting, key)
        if s:
            s.value_json = val_json
        else:
            db.add(AppSetting(key=key, value_json=val_json))
    await db.commit()
    return {"status": "success", "updated_keys": list(payload.settings.keys())}
