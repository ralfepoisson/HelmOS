import pytest

from app.orchestration.runtime import OrchestrationRuntime
from app.schemas.agent import AgentDescriptor, AgentExecutionOutput, ArtifactPayload


class _FakeRun:
    id = "run-1"
    session_id = "session-1"


class _FakeSession:
    id = "session-1"


class _FakeRunRepository:
    async def get_run(self, _run_id: str):
        return _FakeRun()


class _FakeSessionRepository:
    async def get_session(self, _session_id: str):
        return _FakeSession()

    async def list_domain_contexts(self, _session_id: str):
        return []


class _FakeMemoryManager:
    class _Bundle:
        session_context = {}
        domain_memory = {}

    def build_bundle(self, **_kwargs):
        return self._Bundle()


class _FakeAgent:
    descriptor = AgentDescriptor(
        key="ideation",
        name="Ideation Agent",
        version="1.0.0",
        purpose="Create idea briefs.",
        default_model="helmos-default",
        allowed_tools=["retrieval"],
    )

    async def execute(self, _agent_input):
        return AgentExecutionOutput(
            agent_key="ideation",
            version="1.0.0",
            artifact=ArtifactPayload(
                title="Idea Brief",
                kind="idea_brief",
                summary="Founder-facing idea brief.",
                sections=[{"heading": "Brief", "content": "{}"}],
            ),
            structured_output={"reply_to_user": {"content": "Hello"}},
            debug={
                "llm_traces": [
                    {
                        "event_type": "llm.completion_requested",
                        "actor": "llm-gateway",
                        "message": "Requested LLM completion for model helmos-default",
                        "payload": {"request": {"model": "helmos-default"}},
                    },
                    {
                        "event_type": "llm.completion_succeeded",
                        "actor": "llm-gateway",
                        "message": "LLM completion succeeded for model helmos-default",
                        "payload": {
                            "response_content": "{\"reply_to_user\":{\"content\":\"Hello\"}}"
                        },
                    },
                ]
            },
        )


class _FakeSpecialistRegistry:
    async def get(self, _key: str):
        return _FakeAgent()

    async def list_descriptors(self):
        return [_FakeAgent.descriptor]


class _FakeNormalizer:
    def normalize(self, output):
        return {
            "agent_key": output.agent_key,
            "artifact": output.artifact.model_dump(),
            "debug": output.debug,
            **(output.structured_output or {}),
        }


class _FakeRules:
    def classify(self, *_args, **_kwargs):
        return {"route": "agent", "agent_key": "ideation", "confidence": 1.0}


class _FakeGuardrails:
    def evaluate(self, **_kwargs):
        return {"requires_approval": False}


class _FakeModelRouter:
    def for_agent(self, _key: str):
        return "helmos-default"

    def for_supervisor(self):
        return "helmos-supervisor"


class _FakeAuditService:
    def __init__(self):
        self.calls = []

    async def log(self, **kwargs):
        self.calls.append(kwargs)


class _FakeTelemetry:
    def instrument_workflow_node(self, *_args, **_kwargs):
        return None


class _FakeTracer:
    class _Trace:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    def trace(self, *_args, **_kwargs):
        return self._Trace()


class _FakeDocumentExport:
    async def export(self, *_args, **_kwargs):
        return {"note": "memory://artifact.json"}


class _FakeAgentOps:
    def evaluation_hooks(self):
        return []


@pytest.mark.asyncio
async def test_specialist_node_persists_llm_traces_to_run_history():
    audit = _FakeAuditService()
    runtime = OrchestrationRuntime(
        settings=type("Settings", (), {"enable_approvals": False})(),
        run_repository=_FakeRunRepository(),
        session_repository=_FakeSessionRepository(),
        approval_repository=object(),
        specialist_agents=_FakeSpecialistRegistry(),
        normalizer=_FakeNormalizer(),
        rules=_FakeRules(),
        guardrails=_FakeGuardrails(),
        model_router=_FakeModelRouter(),
        document_export=_FakeDocumentExport(),
        memory_manager=_FakeMemoryManager(),
        audit_service=audit,
        telemetry=_FakeTelemetry(),
        tracer=_FakeTracer(),
        agentops_registry=_FakeAgentOps(),
    )

    state = await runtime.specialist_node(
        {
            "run_id": "run-1",
            "session_id": "session-1",
            "input_text": "Help define HelmOS.",
            "selected_agent": "ideation",
            "working_memory": {},
        }
    )

    assert state["normalized_output"]["debug"]["llm_traces"][0]["event_type"] == "llm.completion_requested"
    assert [call["event_type"] for call in audit.calls] == [
        "llm.completion_requested",
        "llm.completion_succeeded",
    ]
