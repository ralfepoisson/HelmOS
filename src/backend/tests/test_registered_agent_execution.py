import pytest

from app.agents.generic import GenericSpecialistAgent
from app.agents.registry import SpecialistAgentRegistry
from app.schemas.agent import AgentDescriptor, AgentExecutionInput
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


def test_registered_agent_build_prompt_includes_chat_history_and_page_state():
    agent = GenericSpecialistAgent(
        descriptor=AgentDescriptor(
            key="ideation",
            name="Ideation Agent",
            version="1.0.0",
            purpose="Create idea briefs.",
            default_model="helmos-default",
            allowed_tools=["retrieval"],
        ),
        instruction_template=(
            "Founder message:\n{prompt}\n\n"
            "Chat history:\n{chat_history_json}\n\n"
            "Current ideation page state:\n{ideation_page_state_json}\n\n"
            "Execution constraints:\n{constraints_json}"
        ),
        config_json={},
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=LLMGateway(
            provider="disabled",
            base_url="http://localhost:4000",
            api_key="unused",
            timeout_seconds=1,
        ),
    )

    prompt = agent.build_prompt(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="What should I do next?",
            context={
                "latest_user_message": "What should I do next?",
                "chat_history": [
                    {"sender": "USER", "content": "HelmOS is an AI-powered founder platform."}
                ],
                "ideation_page_state": {
                    "workspace_name": "HelmOS",
                    "sections": {
                        "problem_statement": "Founders need help turning ideas into action."
                    },
                },
            },
            constraints={"model": "helmos-default"},
        )
    )

    assert "Founder message:\nWhat should I do next?" in prompt
    assert "Chat history:\n[\n  {\n    \"content\": \"HelmOS is an AI-powered founder platform.\"," in prompt
    assert "Current ideation page state:\n{\n  \"sections\": {" in prompt
    assert '"problem_statement": "Founders need help turning ideas into action."' in prompt
    assert '"workspace_name": "HelmOS"' in prompt
    assert '"recent_messages": [' not in prompt
    assert '"model": "helmos-default"' in prompt


class _FakeEnabledLLMGateway:
    def __init__(self, responses: list[str]):
        self.responses = responses
        self.calls = []
        self.traces = []

    @property
    def is_enabled(self) -> bool:
        return True

    async def generate_text(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        self.traces.append(
            {
                "event_type": "llm.completion_succeeded",
                "actor": "llm-gateway",
                "message": f"LLM completion succeeded for model {kwargs.get('model')}",
                "payload": {
                    "request": {
                        "model": kwargs.get("model"),
                        "temperature": kwargs.get("temperature"),
                        "messages": [
                            {"role": "system", "content": kwargs.get("system_prompt")},
                            {"role": "user", "content": kwargs.get("user_prompt")},
                        ],
                    },
                    "response_content": response,
                    "metadata": kwargs.get("metadata", {}),
                },
            }
        )
        return response

    def consume_run_traces(self, _run_id: str):
        traces = list(self.traces)
        self.traces.clear()
        return traces


@pytest.mark.asyncio
async def test_registered_agent_executes_with_composite_system_prompt():
    gateway = _FakeEnabledLLMGateway(
        [
            """
            {
              "reply_to_user": {"content": "A concise reply"},
              "ideation_overview": {
                "completeness_percent": 15,
                "readiness": {
                  "label": "In progress",
                  "reason": "Still early.",
                  "next_best_action": "Clarify the problem."
                }
              },
              "problem_statement": {
                "content": "A clear problem.",
                "priority": "primary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "target_customer": {
                "content": "A clear audience.",
                "priority": "primary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "Value Proposition": {
                "content": "A clear promise.",
                "helper": "",
                "priority": "primary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "product_service_description": {
                "content": "A product description.",
                "priority": "secondary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "differentiation": {
                "content": "A differentiator.",
                "priority": "secondary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "early_monitization_idea": {
                "content": "A pricing hypothesis.",
                "priority": "secondary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              }
            }
            """
        ]
    )
    agent = GenericSpecialistAgent(
        descriptor=AgentDescriptor(
            key="ideation",
            name="Ideation Agent",
            version="1.0.0",
            purpose="Create idea briefs.",
            default_model="helmos-default",
            allowed_tools=["retrieval"],
        ),
        instruction_template="Generate ideation JSON for: {prompt}",
        config_json={
            "temperature": 0.2,
            "purpose": "Help the user transform an initial idea into a structured concept.",
            "scopeNotes": "Focus on early-stage ideation and concept framing.",
            "reasoningMode": "balanced",
            "retryPolicy": "standard",
            "maxSteps": 8,
            "timeoutSeconds": 180,
            "promptSections": {
                "rolePersona": "You are a strategic innovation consultant and product thinker.",
                "taskInstructions": "Help the user transform an initial idea into a well-defined concept.",
                "constraints": "Do not jump to solutions without understanding the problem.",
                "outputFormat": "Return valid ideation JSON only.",
            },
            "toolPermissions": [
                {
                    "key": "retrieval",
                    "label": "Retrieval",
                    "access": "Allowed",
                    "scopePreview": "Semantic and structured retrieval against stored context.",
                    "policyFlags": ["workspace_scoped"],
                }
            ],
        },
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=gateway,
    )

    await agent.execute(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="Help define HelmOS.",
            context={},
            constraints={"model": "helmos-default"},
        )
    )

    assert len(gateway.calls) == 1
    system_prompt = gateway.calls[0]["system_prompt"]
    assert "Primary objective: Help the user transform an initial idea into a structured concept." in system_prompt
    assert "Scope notes: Focus on early-stage ideation and concept framing." in system_prompt
    assert "Role / Persona:" in system_prompt
    assert "Task Instructions:" in system_prompt
    assert "Constraints:" in system_prompt
    assert "Output Format:" in system_prompt
    assert "Execution Context:" in system_prompt
    assert "Permitted Tools:" in system_prompt


@pytest.mark.asyncio
async def test_ideation_agent_preserves_valid_structured_output():
    agent = GenericSpecialistAgent(
        descriptor=AgentDescriptor(
            key="ideation",
            name="Ideation Agent",
            version="1.0.0",
            purpose="Create idea briefs.",
            default_model="helmos-default",
            allowed_tools=["retrieval"],
        ),
        instruction_template="Generate ideation JSON for: {prompt}",
        config_json={
            "artifact_kind": "idea_brief",
            "artifact_title": "Idea Brief",
            "artifact_summary": "Founder-facing idea brief.",
            "output_sections": [
                {"heading": "Brief", "template": "{llm_output}"},
            ],
        },
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=_FakeEnabledLLMGateway(
            [
                """
                {
                  "reply_to_user": {"content": "I tightened the draft."},
                  "ideation_overview": {
                    "completeness_percent": 42,
                    "readiness": {
                      "label": "Needs refinement",
                      "reason": "Core sections are forming.",
                      "next_best_action": "Clarify the target customer."
                    }
                  },
                  "problem_statement": {
                    "content": "A clear problem.",
                    "priority": "primary",
                    "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                    "ui_hints": {"highlight": true, "needs_attention": true}
                  },
                  "target_customer": {
                    "content": "A clear audience.",
                    "priority": "primary",
                    "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                    "ui_hints": {"highlight": true, "needs_attention": true}
                  },
                  "Value Proposition": {
                    "content": "A clear promise.",
                    "priority": "primary",
                    "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                    "ui_hints": {"highlight": true, "needs_attention": true}
                  },
                  "product_service_description": {
                    "content": "A product description.",
                    "priority": "secondary",
                    "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                    "ui_hints": {"highlight": true, "needs_attention": true}
                  },
                  "differentiation": {
                    "content": "A differentiator.",
                    "priority": "secondary",
                    "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                    "ui_hints": {"highlight": true, "needs_attention": true}
                  },
                  "early_monitization_idea": {
                    "content": "A pricing hypothesis.",
                    "priority": "secondary",
                    "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                    "ui_hints": {"highlight": true, "needs_attention": true}
                  }
                }
                """
            ]
        ),
    )

    output = await agent.execute(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="Help define HelmOS.",
            context={},
            constraints={"model": "helmos-default"},
        )
    )

    assert output.structured_output is not None
    assert output.structured_output["reply_to_user"]["content"] == "I tightened the draft."
    assert "reply_to_user" in output.debug["llm_traces"][0]["payload"]["response_content"]
    assert "reply_to_user" in output.debug["raw_llm_output"]


@pytest.mark.asyncio
async def test_ideation_agent_requests_one_correction_when_json_is_invalid():
    gateway = _FakeEnabledLLMGateway(
        [
            "Not valid JSON at all",
            """
            {
              "reply_to_user": {"content": "Corrected response."},
              "ideation_overview": {
                "completeness_percent": 15,
                "readiness": {
                  "label": "In progress",
                  "reason": "Still early.",
                  "next_best_action": "Clarify the problem."
                }
              },
              "problem_statement": {
                "content": "A clear problem.",
                "priority": "primary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "target_customer": {
                "content": "A clear audience.",
                "priority": "primary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "Value Proposition": {
                "content": "A clear promise.",
                "priority": "primary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "product_service_description": {
                "content": "A product description.",
                "priority": "secondary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "differentiation": {
                "content": "A differentiator.",
                "priority": "secondary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              },
              "early_monitization_idea": {
                "content": "A pricing hypothesis.",
                "priority": "secondary",
                "status": {"label": "Draft", "tone": "info", "agent_confidence": "medium", "score": 0.5, "explanation": "Needs work."},
                "ui_hints": {"highlight": true, "needs_attention": true}
              }
            }
            """,
        ]
    )

    agent = GenericSpecialistAgent(
        descriptor=AgentDescriptor(
            key="ideation",
            name="Ideation Agent",
            version="1.0.0",
            purpose="Create idea briefs.",
            default_model="helmos-default",
            allowed_tools=["retrieval"],
        ),
        instruction_template="Generate ideation JSON for: {prompt}",
        config_json={"artifact_kind": "idea_brief"},
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=gateway,
    )

    output = await agent.execute(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="Help define HelmOS.",
            context={},
            constraints={"model": "helmos-default"},
        )
    )

    assert output.structured_output is not None
    assert len(gateway.calls) == 2
    assert "Original request sent to the model:" in gateway.calls[1]["user_prompt"]
    assert "Previous model response:\nNot valid JSON at all" in gateway.calls[1]["user_prompt"]
    assert "The response must conform exactly to this JSON structure:" in gateway.calls[1]["user_prompt"]
    assert '"reply_to_user"' in gateway.calls[1]["user_prompt"]
    assert "Corrected response." in output.debug["raw_llm_output"]


@pytest.mark.asyncio
async def test_prospecting_agent_promotes_valid_structured_output_from_raw_llm_json():
    raw_response = """
    {
      "reply_to_user": {"content": "I refined the prospecting strategy."},
      "strategy_review_overview": {
        "assessment": {
          "label": "Focused search",
          "reason": "The strategy is coherent and only needs small refinements.",
          "next_best_action": "Keep the strongest complaint-led sources active."
        }
      },
      "current_strategy_assessment": {
        "summary": "The current strategy is directionally strong.",
        "observed_strengths": ["Clear objective"],
        "observed_weaknesses": ["A few themes are still broad"],
        "notable_gaps": ["Limited cross-border evidence"],
        "status": {
          "label": "Focused search",
          "tone": "positive",
          "agent_confidence": "High confidence",
          "explanation": "The strategy is usable and coherent."
        }
      },
      "recommended_strategy_update": {
        "prospecting_objective": {
          "objective_name": "Recurring compliance pain",
          "description": "Surface repeated workflow pain in compliance-heavy service businesses.",
          "target_domain": "European SMB services",
          "include_themes": ["recurring admin burden"],
          "exclude_themes": ["generic AI commentary"]
        },
        "search_strategy": {
          "summary": "Lean into repeated operator pain and complaint-led sources.",
          "strategy_patterns": [
            {
              "key": "complaint-mining",
              "label": "Complaint mining",
              "enabled": true,
              "priority": "high",
              "rationale": "It continues to surface concrete evidence."
            }
          ],
          "steering_hypothesis": "Recurring pain in fragmented service workflows remains promising."
        },
        "search_themes": [
          {
            "label": "recurring admin burden",
            "status": "active",
            "priority": "high",
            "rationale": "Repeated admin work is durable pain."
          }
        ],
        "source_mix": [
          {
            "label": "Reddit / forums",
            "enabled": true,
            "expected_signal_type": "Complaint language",
            "rationale": "Forum complaints remain the strongest input.",
            "review_frequency": "Every run"
          }
        ],
        "query_families": [
          {
            "title": "Complaint language around invoicing",
            "intent": "Detect recurring administrative frustration.",
            "representative_queries": ["hate doing invoicing every month"],
            "theme_link": "recurring admin burden",
            "source_applicability": ["Reddit / forums"],
            "status": "active",
            "rationale": "High-evidence lane."
          }
        ],
        "signal_quality_criteria": [
          {
            "title": "Favour repeated mentions over isolated anecdotes",
            "description": "Repeated pain is stronger than a single complaint.",
            "enabled": true,
            "strictness": "high",
            "rationale": "This reduces false positives."
          }
        ],
        "scan_policy": {
          "run_mode": "scheduled",
          "cadence": "Every 4 hours",
          "max_results_per_run": 40,
          "promotion_threshold": "Repeated evidence only",
          "geographic_scope": ["United Kingdom"],
          "language_scope": ["English"],
          "guardrails": ["Prefer complaint-rich sources first"]
        }
      },
      "proposed_changes": [],
      "review_flags": []
    }
    """
    gateway = _FakeEnabledLLMGateway([raw_response])
    agent = GenericSpecialistAgent(
        descriptor=AgentDescriptor(
            key="prospecting",
            name="Prospecting Agent",
            version="1.0.0",
            purpose="Review prospecting strategy.",
            default_model="helmos-default",
            allowed_tools=["web_search"],
        ),
        instruction_template="Review the prospecting strategy: {prompt}",
        config_json={
            "artifact_kind": "prospecting",
            "promptSections": {
                "outputFormat": raw_response,
            },
        },
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=gateway,
    )

    output = await agent.execute(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="Review the current prospecting strategy.",
            context={},
            constraints={"model": "helmos-default"},
        )
    )

    assert output.structured_output is not None
    assert output.structured_output["reply_to_user"]["content"] == "I refined the prospecting strategy."
    assert output.debug["raw_llm_output"] is not None


def test_registered_agent_uses_user_prompt_when_instruction_template_has_no_placeholders():
    agent = GenericSpecialistAgent(
        descriptor=AgentDescriptor(
            key="prospecting",
            name="Prospecting Agent",
            version="1.0.0",
            purpose="Review prospecting strategy.",
            default_model="helmos-default",
            allowed_tools=["web_search"],
        ),
        instruction_template='{"reply_to_user":{"content":""}}',
        config_json={},
        tool_registry=ToolRegistry(adapters=[]),
        template_renderer=TemplateRenderer(),
        llm_gateway=LLMGateway(
            provider="disabled",
            base_url="http://localhost:4000",
            api_key="unused",
            timeout_seconds=1,
        ),
    )

    prompt = agent.build_prompt(
        AgentExecutionInput(
            session_id="session-1",
            run_id="run-1",
            prompt="Review the current prospecting strategy.",
            context={},
            constraints={"model": "helmos-default"},
        )
    )

    assert prompt == "Review the current prospecting strategy."
