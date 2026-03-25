"""Session and domain context persistence."""

from sqlalchemy import select

from app.models.context import DomainContext
from app.models.session import Session
from app.repositories.base import SQLAlchemyRepository


class SessionRepository(SQLAlchemyRepository):
    """Persistence helpers for sessions and structured context."""

    async def create_session(self, session_obj: Session) -> Session:
        return await self.add(session_obj)

    async def get_session(self, session_id: str) -> Session | None:
        return await self.get_by_id(Session, session_id)

    async def get_or_create_session(self, session_obj: Session) -> Session:
        existing = None
        if session_obj.id:
            existing = await self.get_session(session_obj.id)
        if existing:
            return existing
        return await self.create_session(session_obj)

    async def list_domain_contexts(self, session_id: str) -> list[DomainContext]:
        result = await self.session.execute(
            select(DomainContext).where(DomainContext.session_id == session_id)
        )
        return list(result.scalars().all())
