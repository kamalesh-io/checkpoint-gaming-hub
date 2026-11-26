"""Async SQLite database engine with WAL mode and performance PRAGMAs."""
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from app.core.config import settings
from app.core.logging import logger


def create_engine_instance(database_url: str = None) -> AsyncEngine:
    """Creates a configured AsyncEngine for SQLite."""
    url = database_url or settings.get_database_url()
    is_sqlite = "sqlite" in url

    connect_args = {}
    if is_sqlite:
        connect_args["check_same_thread"] = False

    engine = create_async_engine(
        url,
        echo=False,
        future=True,
        connect_args=connect_args,
    )

    if is_sqlite:
        @event.listens_for(engine.sync_engine, "connect")
        def configure_sqlite_pragmas(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA journal_mode = WAL")
                cursor.execute("PRAGMA synchronous = NORMAL")
                cursor.execute("PRAGMA foreign_keys = ON")
                cursor.execute("PRAGMA cache_size = -64000")
                cursor.execute("PRAGMA temp_store = MEMORY")
                cursor.execute("PRAGMA busy_timeout = 5000")
            finally:
                cursor.close()

    return engine


engine = create_engine_instance()


async def init_db() -> None:
    """Initialize database schemas and tables."""
    # Ensure all models are registered on Base
    import app.models  # noqa: F401
    from app.database.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    """Close and dispose of the database engine pools."""
    await engine.dispose()

