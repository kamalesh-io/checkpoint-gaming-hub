"""Unit tests for token bucket rate limiter."""

import asyncio
import time
import pytest
from app.core.rate_limiter import AsyncTokenBucket, APIRateLimiter


@pytest.mark.asyncio
async def test_token_bucket_initial_burst():
    """Verify bucket allows immediate consumption up to full capacity."""
    bucket = AsyncTokenBucket(rate=10.0, capacity=5.0)
    
    start = time.monotonic()
    # Consume all 5 tokens immediately
    for _ in range(5):
        await bucket.acquire(1.0)
    elapsed = time.monotonic() - start
    
    # Should be nearly instantaneous (< 0.1s)
    assert elapsed < 0.1


@pytest.mark.asyncio
async def test_token_bucket_throttling():
    """Verify bucket delays calls once capacity is exhausted."""
    # 5 tokens/sec, capacity of 2
    bucket = AsyncTokenBucket(rate=5.0, capacity=2.0)
    
    # Exhaust initial 2 tokens
    await bucket.acquire(1.0)
    await bucket.acquire(1.0)
    
    start = time.monotonic()
    # Acquiring another token should sleep ~0.2s (1/5th second)
    await bucket.acquire(1.0)
    elapsed = time.monotonic() - start
    
    assert elapsed >= 0.15


@pytest.mark.asyncio
async def test_api_rate_limiter_context_manager():
    """Verify APIRateLimiter async context manager works correctly."""
    limiter = APIRateLimiter(requests_per_second=20.0, max_burst=2.0)
    async with limiter:
        # Inside protected section
        pass
