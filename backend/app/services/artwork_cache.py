"""Artwork caching engine with SHA-256 deduplication and atomic writes."""
import hashlib
import io
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse
import httpx
from PIL import Image
from app.core.config import settings
from app.core.exceptions import SecurityException
from app.core.logging import logger

ALLOWED_ARTWORK_DOMAINS = {
    "images.igdb.com",
    "cdn2.steamgriddb.com",
    "www.steamgriddb.com",
    "steamgriddb.com",
    "shared.akamai.steamstatic.com",
    "cdn.cloudflare.steamstatic.com",
}


def verify_image_magic_bytes(data: bytes) -> Optional[str]:
    """Verifies image format by analyzing file header signatures."""
    if len(data) < 16:
        return None
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    return None


class ArtworkCacheService:
    """Manages secure downloading, deduplicating, and serving local artwork assets."""

    def __init__(self):
        settings.ensure_directories()
        self.base_dir = settings.ARTWORK_CACHE_DIR

    def _validate_url(self, url: str) -> None:
        """Enforces domain whitelisting to prevent SSRF attacks."""
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise SecurityException(f"Unsupported URL scheme: {parsed.scheme}")
        hostname = (parsed.hostname or "").lower()
        if not any(hostname == domain or hostname.endswith(f".{domain}") for domain in ALLOWED_ARTWORK_DOMAINS):
            raise SecurityException(f"Host '{hostname}' is not in the approved artwork whitelist.")

    async def download_and_cache(
        self,
        remote_url: str,
        category: str = "covers",
        custom_filename: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Downloads remote image, validates magic bytes, deduplicates via SHA-256, and atomically caches."""
        if not remote_url:
            return None

        self._validate_url(remote_url)
        target_category_dir = self.base_dir / category
        target_category_dir.mkdir(parents=True, exist_ok=True)

        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS, follow_redirects=True) as client:
                response = await client.get(remote_url)
                if response.status_code != 200:
                    logger.warning(f"Failed to download artwork [{response.status_code}] from {remote_url}")
                    return None

                data = response.content
                if len(data) > settings.MAX_ARTWORK_FILE_SIZE_BYTES:
                    logger.warning(f"Artwork payload from {remote_url} exceeds max allowed size ({len(data)} bytes)")
                    return None

                # Verify image magic bytes
                mime_type = verify_image_magic_bytes(data)
                if not mime_type:
                    logger.warning(f"Corrupt or non-image payload rejected from {remote_url}")
                    return None

                # SHA-256 deduplication
                sha256_hash = hashlib.sha256(data).hexdigest()
                ext = {
                    "image/jpeg": ".jpg",
                    "image/png": ".png",
                    "image/webp": ".webp",
                    "image/gif": ".gif",
                }.get(mime_type, ".jpg")

                filename = f"{sha256_hash}{ext}"
                final_path = target_category_dir / filename

                # If file already exists in cache, extract dimensions and return immediately
                if final_path.exists():
                    try:
                        with Image.open(final_path) as img:
                            w, h = img.size
                        return {
                            "local_path": str(final_path),
                            "sha256_hash": sha256_hash,
                            "width": w,
                            "height": h,
                            "file_size_bytes": final_path.stat().st_size,
                            "mime_type": mime_type,
                            "is_animated": mime_type == "image/gif" or getattr(img, "is_animated", False),
                        }
                    except Exception:
                        pass  # If existing file is somehow damaged, re-write below

                # Verify image integrity and dimensions using Pillow
                try:
                    with Image.open(io.BytesIO(data)) as img:
                        img.verify()
                        w, h = img.size
                        is_animated = getattr(img, "is_animated", False) or mime_type == "image/gif"
                except Exception as exc:
                    logger.warning(f"Pillow image verification failed for {remote_url}: {exc}")
                    return None

                # Atomic file write using a temporary file in the same directory
                temp_path = target_category_dir / f"{filename}.tmp_{os.getpid()}"
                with open(temp_path, "wb") as f:
                    f.write(data)
                temp_path.replace(final_path)

                logger.info(f"Cached artwork asset: {final_path.name} ({w}x{h}, {len(data)} bytes)")
                return {
                    "local_path": str(final_path),
                    "sha256_hash": sha256_hash,
                    "width": w,
                    "height": h,
                    "file_size_bytes": len(data),
                    "mime_type": mime_type,
                    "is_animated": is_animated,
                }

        except Exception as exc:
            logger.error(f"Error downloading or caching artwork from {remote_url}: {exc}")
            return None

    def get_cache_stats(self) -> Dict[str, Any]:
        """Calculates total cached files and disk consumption across categories."""
        categories = ["covers", "heroes", "logos", "screenshots", "animated", "thumbnails"]
        stats = {}
        total_files = 0
        total_size = 0

        for cat in categories:
            cat_dir = self.base_dir / cat
            count = 0
            size = 0
            if cat_dir.exists():
                for f in cat_dir.iterdir():
                    if f.is_file() and not f.name.endswith(".tmp"):
                        count += 1
                        size += f.stat().st_size
            stats[cat] = {"count": count, "size_bytes": size}
            total_files += count
            total_size += size

        def format_size(b: int) -> str:
            if b < 1024 * 1024:
                return f"{b / 1024:.1f} KB"
            if b < 1024 * 1024 * 1024:
                return f"{b / (1024 * 1024):.1f} MB"
            return f"{b / (1024 * 1024 * 1024):.2f} GB"

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "formatted_size": format_size(total_size),
            "cache_directory": str(self.base_dir),
            "categories": stats,
        }

    def clear_cache(self) -> Dict[str, int]:
        """Safely cleans cached files."""
        deleted = 0
        for cat in ["covers", "heroes", "logos", "screenshots", "animated", "thumbnails"]:
            cat_dir = self.base_dir / cat
            if cat_dir.exists():
                for f in cat_dir.iterdir():
                    if f.is_file():
                        try:
                            f.unlink()
                            deleted += 1
                        except Exception:
                            pass
        return {"deleted_files": deleted}


artwork_cache = ArtworkCacheService()
