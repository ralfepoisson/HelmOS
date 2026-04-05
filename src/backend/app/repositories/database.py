"""Database manager and async session factory."""

from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base


class DatabaseManager:
    """Owns the async SQLAlchemy engine and session factory."""

    def __init__(self, settings, *, database_url_override: str | None = None):
        self._settings = settings
        self.engine: AsyncEngine = create_async_engine(
            database_url_override or settings.database_url,
            future=True,
            pool_pre_ping=True,
        )
        self.session_factory = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

    async def initialize(self) -> None:
        """Create tables for the first iteration.

        TODO: replace with Alembic-managed migrations.
        """

        async with self.engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)

    async def dispose(self) -> None:
        """Dispose the engine cleanly."""

        await self.engine.dispose()

    async def session(self) -> AsyncIterator[AsyncSession]:
        """Yield an async database session."""

        async with self.session_factory() as session:
            yield session
