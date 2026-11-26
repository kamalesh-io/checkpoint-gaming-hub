"""Pytest configuration and test fixtures for CHECKPOINT Gaming Hub."""

import asyncio
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Force testing environment before importing app modules
import os
os.environ["APP_ENV"] = "testing"
os.environ["CHECKPOINT_AUTH_TOKEN"] = "test-secret-token-12345"

from app.core.config import settings
from app.database.base import Base
from app.database.session import get_db
import app.models  # Ensure all models are registered
from app.main import app


# In-memory SQLite async engine with static pool for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Create an isolated in-memory SQLite database engine per test."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated database session for testing."""
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(test_engine, db_session) -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTP test client connected to the FastAPI app with test DB override."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app, client=("127.0.0.1", 50000))
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"X-Checkpoint-Token": "test-secret-token-12345"}
    ) as ac:
        yield ac
        
    app.dependency_overrides.clear()
