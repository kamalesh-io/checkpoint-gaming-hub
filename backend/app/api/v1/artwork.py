"""Artwork API endpoints.

Handles asset retrieval, selection of active artwork, and serving cached images.
"""

from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.exceptions import ResourceNotFoundException, ValidationException
from app.database.session import get_db
from app.models.artwork import GameArtwork, AssetType
from app.schemas.artwork import GameArtworkResponse, ArtworkSelectRequest
from app.services.artwork_cache import ArtworkCacheService

router = APIRouter(prefix="/artwork", tags=["artwork"])
cache_service = ArtworkCacheService()


@router.get("/cache/status", response_model=dict)
async def get_cache_status():
    """Retrieve local artwork cache storage statistics."""
    stats = cache_service.get_cache_stats()
    return {
        "status": "success",
        "cache_directory": str(settings.ARTWORK_CACHE_DIR),
        "total_files": stats["total_files"],
        "total_size_bytes": stats["total_size_bytes"],
        "formatted_size": stats["formatted_size"],
        "by_category": stats["categories"],
    }


@router.get("/cache/{category}/{filename}")
async def serve_cached_artwork(category: str, filename: str):
    """Serve cached artwork file securely.
    
    Validates category path and ensures no directory traversal occurs.
    """
    valid_categories = {"covers", "heroes", "logos", "screenshots", "animated", "thumbnails"}
    if category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid artwork category '{category}'. Must be one of: {sorted(valid_categories)}"
        )
    
    # Sanitize filename against path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename format.")
        
    file_path = settings.ARTWORK_CACHE_DIR / category / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cached artwork not found.")
        
    # Determine MIME type based on extension
    suffix = file_path.suffix.lower()
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".gif": "image/gif",
    }
    media_type = media_types.get(suffix, "application/octet-stream")
    
    # Return file response with caching headers (immutable content-addressed images)
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        }
    )


@router.get("/{asset_id}", response_model=GameArtworkResponse)
async def get_artwork_details(asset_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve detailed metadata for a specific artwork asset."""
    result = await db.execute(select(GameArtwork).where(GameArtwork.id == asset_id))
    artwork = result.scalar_one_or_none()
    if not artwork:
        raise ResourceNotFoundException("GameArtwork", asset_id)
        
    return GameArtworkResponse.model_validate(artwork)


@router.post("/select", response_model=GameArtworkResponse)
async def set_active_artwork(
    req: ArtworkSelectRequest,
    db: AsyncSession = Depends(get_db)
):
    """Set a specific artwork asset as active for a game.
    
    Can activate an existing asset_id, or download from steamgriddb_url and activate it.
    Automatically marks other artworks of the same game and asset_type as inactive.
    """
    artwork: Optional[GameArtwork] = None
    width_hint = req.width
    height_hint = req.height
    author_hint = req.author

    if req.asset_id:
        result = await db.execute(select(GameArtwork).where(GameArtwork.id == req.asset_id))
        artwork = result.scalar_one_or_none()
        if not artwork:
            raise ResourceNotFoundException("GameArtwork", req.asset_id)
    elif req.steamgriddb_url and req.game_id and req.asset_type:
        try:
            validated_type = AssetType(req.asset_type)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid asset_type '{req.asset_type}'.")

        existing_res = await db.execute(
            select(GameArtwork).where(
                GameArtwork.game_id == req.game_id,
                GameArtwork.asset_type == validated_type.value,
                GameArtwork.remote_url == req.steamgriddb_url,
            )
        )
        artwork = existing_res.scalar_one_or_none()
    else:
        raise HTTPException(
            status_code=400,
            detail="Must provide either asset_id OR (game_id, asset_type, and steamgriddb_url)."
        )

    category_map = {
        AssetType.COVER.value: "covers",
        AssetType.HERO.value: "heroes",
        AssetType.LOGO.value: "logos",
        AssetType.SCREENSHOT.value: "screenshots",
        AssetType.ANIMATED.value: "animated",
        AssetType.THUMBNAIL.value: "thumbnails",
    }

    if not artwork:
        validated_value = AssetType(req.asset_type).value
        cache_category = category_map.get(validated_value, "covers")
        cached = await cache_service.download_and_cache(req.steamgriddb_url, cache_category)
        if not cached:
            raise HTTPException(status_code=502, detail="Failed to fetch and cache artwork from remote URL.")

        import uuid
        artwork = GameArtwork(
            id=str(uuid.uuid4()),
            game_id=req.game_id,
            asset_type=validated_value,
            remote_url=req.steamgriddb_url,
            local_path=str(cached["local_path"]),
            sha256_hash=cached["sha256_hash"],
            width=cached["width"] or width_hint,
            height=cached["height"] or height_hint,
            file_size_bytes=cached["file_size_bytes"],
            mime_type=cached["mime_type"],
            is_active=True,
            is_animated=cached["is_animated"],
            source="igdb" if "igdb.com" in req.steamgriddb_url else "steamgriddb",
            author=author_hint,
        )
        db.add(artwork)
    elif artwork.remote_url:
        cache_category = category_map.get(artwork.asset_type, "covers")
        expected_cached_path = (
            settings.ARTWORK_CACHE_DIR / cache_category / Path(artwork.local_path).name
            if artwork.local_path
            else None
        )
        if expected_cached_path is None or not expected_cached_path.is_file():
            cached = await cache_service.download_and_cache(artwork.remote_url, cache_category)
            if not cached:
                raise HTTPException(status_code=502, detail="Failed to re-cache missing artwork asset.")
            artwork.local_path = str(cached["local_path"])
            artwork.sha256_hash = cached["sha256_hash"]
            artwork.width = cached["width"] or artwork.width or width_hint
            artwork.height = cached["height"] or artwork.height or height_hint
            artwork.file_size_bytes = cached["file_size_bytes"]
            artwork.mime_type = cached["mime_type"]
            artwork.is_animated = cached["is_animated"]
        
    # Unset other active artworks of the same type for this game
    other_artworks = await db.execute(
        select(GameArtwork).where(
            GameArtwork.game_id == artwork.game_id,
            GameArtwork.asset_type == artwork.asset_type,
            GameArtwork.is_active.is_(True),
            GameArtwork.id != artwork.id
        )
    )
    for other in other_artworks.scalars().all():
        other.is_active = False
        
    artwork.is_active = True
    await db.commit()
    await db.refresh(artwork)
    
    return GameArtworkResponse.model_validate(artwork)
