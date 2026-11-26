"""Async rate limiting utilities for external API clients."""
import asyncio
import time
from typing import Optional
from app.core.exceptions import RateLimitException
from app.core.logging import logger


class AsyncTokenBucket:
    """Thread-safe and async-safe token bucket rate limiter."""

    def __init__(self, rate: float, capacity: float):
        self.rate = rate  # Tokens per second
        self.capacity = capacity
        self.tokens = capacity
        self.last_updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: float = 1.0) -> None:
        """Waits asynchronously until tokens are available."""
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_updated
                self.last_updated = now

                # Replenish tokens based on elapsed time
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)

                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return

                # Calculate required sleep time
                deficit = tokens - self.tokens
                wait_time = deficit / self.rate

            # Sleep outside lock to avoid blocking other coroutines
            await asyncio.sleep(wait_time)


class APIRateLimiter:
    """Manages rate limits for external providers (IGDB, SteamGridDB)."""

    def __init__(self, requests_per_second: float = 4.0, max_burst: float = 4.0):
        self.bucket = AsyncTokenBucket(rate=requests_per_second, capacity=max_burst)
        self.semaphore = asyncio.Semaphore(int(max_burst))

    async def __aenter__(self):
        await self.semaphore.acquire()
        await self.bucket.acquire(1.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.semaphore.release()
