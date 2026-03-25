import pytest

from app.agents.registry import SpecialistAgentRegistry
from app.services.llm_gateway import LLMGateway
from app.services.template_renderer import TemplateRenderer
from app.tools.registry import ToolRegistry


class _FakeAgentDefinition:
    key = "ideation"
    name = "Ideation Agent"
    version = "1.0.0"
    description = "Create idea briefs."
    allowed_tools = ["retrieval"]
    default_model = "helmos-default"
    active = True


class _FakePromptConfig:
    key = "ideation.default"
    prompt_template = "Generate an idea brief from: {prompt}"
    config_json = {"artifact_kind": "idea_brief", "artifact_title": "Idea Brief"}


class _FakeRegistryRepository:
    async def get_agent_definition(self, key: str):
        return _FakeAgentDefinition() if key == "ideation" else None

    async def get_prompt_config_for_agent(self, agent_key: str):
        return _FakePromptConfig() if agent_key == "ideation" else None

    async def list_active_agents(self):
        return [_FakeAgentDefinition()]


@pytest.mark.asyncio
async def test_runtime_registry_builds_agent_from_database_records():
    registry = SpecialistAgentRegistry(
        registry_repository=_FakeRegistryRepository(),
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=LLMGateway(
            provider="disabled",
            base_url="http://localhost:4000",
            api_key="unused",
            timeout_seconds=1,
        ),
    )

    agent = await registry.get("ideation")
    descriptors = await registry.list_descriptors()

    assert agent.descriptor.key == "ideation"
    assert agent.descriptor.default_model == "helmos-default"
    assert agent.config_json["artifact_kind"] == "idea_brief"
    assert descriptors[0].key == "ideation"
