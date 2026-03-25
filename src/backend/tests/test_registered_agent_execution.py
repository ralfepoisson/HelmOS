import pytest

from app.agents.registry import SpecialistAgentRegistry
from app.schemas.agent import AgentExecutionInput
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
    config_json = {
        "artifact_kind": "idea_brief",
        "artifact_title": "Idea Brief",
        "artifact_summary": "Founder-facing idea brief.",
        "fallback_template": "Draft summary for: {prompt}",
        "output_sections": [
            {"heading": "Opportunity", "template": "{prompt}"},
            {"heading": "Brief", "template": "{llm_output}"},
        ],
        "next_actions": ["Validate assumptions"],
    }


class _FakeRegistryRepository:
    async def get_agent_definition(self, key: str):
        return _FakeAgentDefinition() if key == "ideation" else None

    async def get_prompt_config_for_agent(self, agent_key: str):
        return _FakePromptConfig() if agent_key == "ideation" else None

    async def list_active_agents(self):
        return [_FakeAgentDefinition()]


@pytest.mark.asyncio
async def test_registered_agent_executes_with_database_prompt_config():
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
    output = await agent.execute(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="Help define an AI strategy workspace for founders.",
            context={},
            constraints={"model": "helmos-default"},
        )
    )

    assert output.agent_key == "ideation"
    assert output.artifact.kind == "idea_brief"
    assert output.artifact.title == "Idea Brief"
    assert output.artifact.sections[0]["heading"] == "Opportunity"
    assert output.next_actions == ["Validate assumptions"]
    assert output.requested_tools == []
