"""Common repository helpers."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class SQLAlchemyRepository:
    """Lightweight base repository."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, instance):
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def get_by_id(self, model, instance_id: str):
        return await self.session.get(model, instance_id)

    async def list_all(self, model):
        result = await self.session.execute(select(model))
        return list(result.scalars().all())
