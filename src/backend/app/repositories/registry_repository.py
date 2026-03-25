"""AgentOps registry persistence helpers."""

from sqlalchemy import select

from app.models.registry import AgentDefinition, PromptConfig
from app.repositories.base import SQLAlchemyRepository


class RegistryRepository(SQLAlchemyRepository):
    """Persistence helpers for agent and prompt registry entries."""

    async def list_active_agents(self) -> list[AgentDefinition]:
        result = await self.session.execute(
            select(AgentDefinition).where(AgentDefinition.active.is_(True))
        )
        return list(result.scalars().all())

    async def get_agent_definition(self, key: str) -> AgentDefinition | None:
        result = await self.session.execute(select(AgentDefinition).where(AgentDefinition.key == key))
        return result.scalar_one_or_none()

    async def get_prompt_config(self, key: str) -> PromptConfig | None:
        result = await self.session.execute(
            select(PromptConfig)
            .where(PromptConfig.key == key, PromptConfig.active.is_(True))
            .order_by(PromptConfig.version.desc())
        )
        return result.scalars().first()

    async def get_prompt_config_for_agent(self, agent_key: str) -> PromptConfig | None:
        result = await self.session.execute(
            select(PromptConfig)
            .where(
                PromptConfig.key.like(f"{agent_key}.%"),
                PromptConfig.active.is_(True),
            )
            .order_by(PromptConfig.updated_at.desc())
        )
        return result.scalars().first()
