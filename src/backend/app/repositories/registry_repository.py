"""AgentOps registry persistence helpers."""

from sqlalchemy import or_, select

from app.models.registry import AgentDefinition, PromptConfig
from app.repositories.base import SQLAlchemyRepository


def build_prompt_key_prefixes(agent_key: str) -> list[str]:
    """Return supported prompt-config key prefixes for an agent."""

    normalized_key = agent_key.strip()
    if not normalized_key:
        return []

    legacy_key = f"{normalized_key}-agent"
    prefixes = [f"{normalized_key}."]
    if legacy_key != normalized_key:
        prefixes.append(f"{legacy_key}.")
    return prefixes


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
        key_prefixes = build_prompt_key_prefixes(agent_key)
        if not key_prefixes:
            return None

        result = await self.session.execute(
            select(PromptConfig)
            .where(
                or_(*(PromptConfig.key.like(f"{prefix}%") for prefix in key_prefixes)),
                PromptConfig.active.is_(True),
            )
            .order_by(PromptConfig.updated_at.desc())
        )
        return result.scalars().first()
