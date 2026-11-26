"""Unit tests for artwork caching, magic byte verification, and SSRF prevention."""

import io
import pytest
from PIL import Image
from app.core.exceptions import SecurityException
from app.services.artwork_cache import ArtworkCacheService, verify_image_magic_bytes


def create_test_image(format_name: str = "PNG") -> bytes:
    """Helper to generate valid in-memory image bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color=(100, 150, 200))
    img.save(buf, format=format_name)
    return buf.getvalue()


def test_magic_byte_verification():
    """Verify detection of JPEG, PNG, WEBP, and rejection of arbitrary bytes."""
    png_bytes = create_test_image("PNG")
    assert verify_image_magic_bytes(png_bytes) == "image/png"

    jpeg_bytes = create_test_image("JPEG")
    assert verify_image_magic_bytes(jpeg_bytes) == "image/jpeg"

    # Corrupt or non-image payload
    assert verify_image_magic_bytes(b"<script>alert(1)</script>") is None
    assert verify_image_magic_bytes(b"PK\x03\x04") is None  # ZIP file header
    assert verify_image_magic_bytes(b"") is None


def test_ssrf_domain_validation():
    """Verify allowed and blocked domains for external artwork downloads."""
    service = ArtworkCacheService()

    # Allowed domains
    service._validate_url("https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg")
    service._validate_url("https://cdn2.steamgriddb.com/grid/abcdef123456.png")
    service._validate_url("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg")

    # Blocked domains (SSRF prevention)
    with pytest.raises(SecurityException):
        service._validate_url("http://169.254.169.254/latest/meta-data/")

    with pytest.raises(SecurityException):
        service._validate_url("http://localhost:8080/exploit.png")

    with pytest.raises(SecurityException):
        service._validate_url("https://malicious-domain.com/evil.png")


def test_cache_stats_calculation(tmp_path):
    """Verify cache statistics calculation across categories."""
    service = ArtworkCacheService()
    service.base_dir = tmp_path
    
    # Create category directories and dummy files
    covers_dir = tmp_path / "covers"
    covers_dir.mkdir(parents=True)
    (covers_dir / "test1.jpg").write_bytes(b"x" * 1024)
    (covers_dir / "test2.jpg").write_bytes(b"x" * 2048)

    stats = service.get_cache_stats()
    assert stats["total_files"] == 2
    assert stats["total_size_bytes"] == 3072
    assert stats["categories"]["covers"]["count"] == 2
    assert stats["categories"]["covers"]["size_bytes"] == 3072
