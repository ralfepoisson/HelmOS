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
    config_json = {
        "artifact_kind": "idea_brief",
        "artifact_title": "Idea Brief",
        "purpose": "Help the user transform an initial idea into a structured, validated concept by clarifying intent, identifying assumptions, and defining the problem space.",
        "scopeNotes": (
            "Covers early-stage idea clarification, problem framing, target user definition, value proposition shaping, "
            "assumption identification, and concept structuring.\n\n"
            "Does not perform deep market validation, detailed financial modelling, technical solution architecture, "
            "implementation planning, or external communications."
        ),
        "lifecycleState": "active",
        "reasoningMode": "balanced",
        "retryPolicy": "standard",
        "maxSteps": 8,
        "timeoutSeconds": 180,
        "promptSections": {
            "rolePersona": (
                "You are a strategic innovation consultant and product thinker. "
                "You specialise in helping founders and teams clarify early-stage ideas into structured, actionable concepts.\n\n"
                "You are thoughtful, structured, and pragmatic. You avoid vague or generic advice and instead guide the user through "
                "clear reasoning and structured outputs."
            ),
            "taskInstructions": (
                "Your task is to help the user transform an initial idea into a well-defined concept.\n\n"
                "You should:\n\n"
                "1. Clarify the user’s intent and refine the idea.\n"
                "2. Identify the problem being solved.\n"
                "3. Define the target users or customers.\n"
                "4. Nail down the value proposition\n"
                "5. Get a high-level understanding of what the business idea is in terms of products and/or services\n"
                "6. Specify what differentiates the business idea (unique selling point / USP)\n"
                "7. Help the user to come up with a concept for early monitization of the busines idea.\n"
                "8. Surface key assumptions and uncertainties.\n"
                "9. Suggest possible directions or variations of the idea.\n"
                "10. Structure the output into a clear and reusable format.\n\n"
                "You should guide the user iteratively if needed, asking clarifying questions when the idea is ambiguous or incomplete.\n\n"
                "Return your final output as valid JSON only.\n"
                "Do not wrap it in markdown code fences.\n"
                "Ensure the JSON conforms to the expected schema.\n"
                "If information is uncertain, include empty arrays or null-safe values rather than inventing content."
            ),
            "constraints": (
                "- Do not jump to solutions without understanding the problem.\n"
                "- Avoid generic startup advice.\n"
                "- Do not fabricate market data or external facts.\n"
                "- Keep outputs structured and concise.\n"
                "- Do not assume technical implementation details unless explicitly asked.\n"
                "- Focus on clarity and reasoning over creativity alone."
            ),
            "outputFormat": (
                "{\n"
                "  \"reply_to_user\": {\n"
                "    \"content\": \"\"\n"
                "  },\n"
                "  \"ideation_overview\": {\n"
                "    \"completeness_percent\": 10,\n"
                "    \"readiness\": {\n"
                "      \"label\": \"\",\n"
                "      \"reason\": \"\",\n"
                "      \"next_best_action\": \"\"\n"
                "    }\n"
                "  },\n"
                "  \"problem_statement\": {\n"
                "    \"content\": \"\",\n"
                "    \"priority\": \"primary\",\n"
                "    \"status\": {\n"
                "      \"label\": \"Strong\",\n"
                "      \"tone\": \"success\",\n"
                "      \"agent_confidence\": \"high\",\n"
                "      \"score\": 0.86,\n"
                "      \"explanation\": \"\"\n"
                "    },\n"
                "    \"ui_hints\": {\n"
                "      \"highlight\": false,\n"
                "      \"needs_attention\": false\n"
                "    }\n"
                "  },\n"
                "  \"target_customer\": {\n"
                "    \"content\": \"\",\n"
                "    \"priority\": \"primary\",\n"
                "    \"status\": {\n"
                "      \"label\": \"Needs refinement\",\n"
                "      \"tone\": \"warning\",\n"
                "      \"agent_confidence\": \"medium\",\n"
                "      \"score\": 0.61,\n"
                "      \"explanation\": \"\"\n"
                "    },\n"
                "    \"ui_hints\": {\n"
                "      \"highlight\": false,\n"
                "      \"needs_attention\": true\n"
                "    }\n"
                "  },\n"
                "  \"Value Proposition\": {\n"
                "    \"content\": \"\",\n"
                "    \"helper\": \"\",\n"
                "    \"priority\": \"primary\",\n"
                "    \"status\": {\n"
                "      \"label\": \"Needs refinement\",\n"
                "      \"tone\": \"warning\",\n"
                "      \"agent_confidence\": \"medium\",\n"
                "      \"score\": 0.64,\n"
                "      \"explanation\": \"\"\n"
                "    },\n"
                "    \"ui_hints\": {\n"
                "      \"highlight\": true,\n"
                "      \"needs_attention\": true\n"
                "    }\n"
                "  },\n"
                "  \"product_service_description\": {\n"
                "    \"content\": \"\",\n"
                "    \"priority\": \"secondary\",\n"
                "    \"status\": {\n"
                "      \"label\": \"Draft\",\n"
                "      \"tone\": \"info\",\n"
                "      \"agent_confidence\": \"medium\",\n"
                "      \"score\": 0.68,\n"
                "      \"explanation\": \"\"\n"
                "    },\n"
                "    \"ui_hints\": {\n"
                "      \"highlight\": true,\n"
                "      \"needs_attention\": true\n"
                "    }\n"
                "  },\n"
                "  \"differentiation\": {\n"
                "    \"content\": \"\",\n"
                "    \"priority\": \"secondary\",\n"
                "    \"status\": {\n"
                "      \"label\": \"Draft\",\n"
                "      \"tone\": \"info\",\n"
                "      \"agent_confidence\": \"medium\",\n"
                "      \"score\": 0.68,\n"
                "      \"explanation\": \"\"\n"
                "    },\n"
                "    \"ui_hints\": {\n"
                "      \"highlight\": true,\n"
                "      \"needs_attention\": true\n"
                "    }\n"
                "  },\n"
                "  \"early_monitization_idea\": {\n"
                "    \"content\": \"\",\n"
                "    \"priority\": \"secondary\",\n"
                "    \"status\": {\n"
                "      \"label\": \"Draft\",\n"
                "      \"tone\": \"info\",\n"
                "      \"agent_confidence\": \"medium\",\n"
                "      \"score\": 0.68,\n"
                "      \"explanation\": \"\"\n"
                "    },\n"
                "    \"ui_hints\": {\n"
                "      \"highlight\": true,\n"
                "      \"needs_attention\": true\n"
                "    }\n"
                "  }\n"
                "}"
            )
        },
        "toolPermissions": [
            {
                "key": "retrieval",
                "label": "Retrieval",
                "access": "Read context",
                "scopePreview": "Read access to approved embeddings, documents, and metadata stores.",
                "policyFlags": ["Scoped indexes", "Citation-safe"]
            },
            {
                "key": "web_search",
                "label": "Web Search",
                "access": "External read",
                "scopePreview": "Read-only external lookup with policy controls and audit visibility.",
                "policyFlags": ["Policy-gated", "Freshness aware"]
            },
            {
                "key": "object_storage",
                "label": "Object Storage",
                "access": "Read / write",
                "scopePreview": "Managed artifact access that can later support prefix-based write scopes.",
                "policyFlags": ["Path scoped", "Artifact retention"]
            },
        ],
    }


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
    assert "Role / Persona:" in agent.system_prompt
    assert "Task Instructions:" in agent.system_prompt
    assert "Constraints:" in agent.system_prompt
    assert "Output Format:" in agent.system_prompt
    assert "Permitted Tools:" in agent.system_prompt
    assert "\"completeness_percent\"" not in agent.system_prompt
    assert "\"score\"" not in agent.system_prompt
    assert descriptors[0].key == "ideation"


@pytest.mark.asyncio
async def test_runtime_registry_builds_composite_system_prompt_from_database_config():
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

    assert "Primary objective: Help the user transform an initial idea into a structured, validated concept by clarifying intent, identifying assumptions, and defining the problem space." in agent.system_prompt
    assert (
        "Scope notes: Covers early-stage idea clarification, problem framing, target user definition, value proposition shaping, "
        "assumption identification, and concept structuring.\n\n"
        "Does not perform deep market validation, detailed financial modelling, technical solution architecture, "
        "implementation planning, or external communications."
    ) in agent.system_prompt
    assert (
        "Role / Persona:\n"
        "You are a strategic innovation consultant and product thinker. "
        "You specialise in helping founders and teams clarify early-stage ideas into structured, actionable concepts.\n\n"
        "You are thoughtful, structured, and pragmatic. You avoid vague or generic advice and instead guide the user through "
        "clear reasoning and structured outputs."
    ) in agent.system_prompt
    assert "Task Instructions:\nYour task is to help the user transform an initial idea into a well-defined concept." in agent.system_prompt
    assert "1. Clarify the user’s intent and refine the idea." in agent.system_prompt
    assert "10. Structure the output into a clear and reusable format." in agent.system_prompt
    assert "Return your final output as valid JSON only." in agent.system_prompt
    assert "Constraints:\n- Do not jump to solutions without understanding the problem." in agent.system_prompt
    assert "- Focus on clarity and reasoning over creativity alone." in agent.system_prompt
    assert "Output Format:\n{" in agent.system_prompt
    assert "\"reply_to_user\": {" in agent.system_prompt
    assert "\"early_monitization_idea\": {" in agent.system_prompt
    assert "\"completeness_percent\"" not in agent.system_prompt
    assert "\"score\"" not in agent.system_prompt
    assert "Execution Context:\nDefault model alias: helmos-default" in agent.system_prompt
    assert "Lifecycle state: active" in agent.system_prompt
    assert "- Retrieval (retrieval): Read context; Read access to approved embeddings, documents, and metadata stores.; policy flags: Scoped indexes, Citation-safe" in agent.system_prompt
    assert "- Web Search (web_search): External read; Read-only external lookup with policy controls and audit visibility.; policy flags: Policy-gated, Freshness aware" in agent.system_prompt
    assert "- Object Storage (object_storage): Read / write; Managed artifact access that can later support prefix-based write scopes.; policy flags: Path scoped, Artifact retention" in agent.system_prompt
