"""Database-backed specialist agent registry."""

from app.agents.generic import GenericSpecialistAgent
from app.repositories.registry_repository import RegistryRepository
from app.schemas.agent import AgentDescriptor
from app.services.llm_gateway import LLMGateway
from app.services.template_renderer import TemplateRenderer
from app.tools.registry import ToolRegistry


class SpecialistAgentRegistry:
    """Loads runtime agents from database registration records."""

    def __init__(
        self,
        *,
        registry_repository: RegistryRepository,
        tool_registry: ToolRegistry,
        template_renderer: TemplateRenderer,
        llm_gateway: LLMGateway,
    ):
        self.registry_repository = registry_repository
        self.tool_registry = tool_registry
        self.template_renderer = template_renderer
        self.llm_gateway = llm_gateway

    async def get(self, key: str) -> GenericSpecialistAgent:
        agent_definition = await self.registry_repository.get_agent_definition(key)
        if agent_definition is None or not agent_definition.active:
            raise LookupError(f"Unknown active specialist agent '{key}'.")

        prompt_config = await self.registry_repository.get_prompt_config_for_agent(key)
        instruction_template = (
            prompt_config.prompt_template
            if prompt_config is not None
            else self._default_prompt_template(agent_definition.name)
        )
        config_json = dict(prompt_config.config_json) if prompt_config is not None else {}
        config_json.setdefault("prompt_key", prompt_config.key if prompt_config is not None else None)

        return GenericSpecialistAgent(
            descriptor=AgentDescriptor(
                key=agent_definition.key,
                name=agent_definition.name,
                version=agent_definition.version,
                purpose=agent_definition.description or f"Execute {agent_definition.name} tasks.",
                default_model=agent_definition.default_model,
                allowed_tools=list(agent_definition.allowed_tools or []),
            ),
            instruction_template=instruction_template,
            config_json=config_json,
            tool_registry=self.tool_registry,
            template_renderer=self.template_renderer,
            llm_gateway=self.llm_gateway,
        )

    async def list_descriptors(self) -> list[AgentDescriptor]:
        agents = await self.registry_repository.list_active_agents()
        return [
            AgentDescriptor(
                key=agent.key,
                name=agent.name,
                version=agent.version,
                purpose=agent.description or f"Execute {agent.name} tasks.",
                default_model=agent.default_model,
                allowed_tools=list(agent.allowed_tools or []),
            )
            for agent in agents
        ]

    @staticmethod
    def _default_prompt_template(agent_name: str) -> str:
        return (
            f"You are the HelmOS {agent_name}.\n"
            "Respond to this founder request:\n"
            "{prompt}\n"
            "Context: {context}\n"
            "Constraints: {constraints}"
        )
