import pytest

from app.services import llm_gateway as llm_gateway_module
from app.services.llm_gateway import LLMGateway


class _FakeResponse:
    def __init__(self, content: str):
        self.choices = [type("Choice", (), {"message": type("Message", (), {"content": content})()})()]
        self.usage = {"prompt_tokens": 123, "completion_tokens": 45}

    def model_dump(self, mode="json"):
        return {
            "choices": [
                {
                    "message": {
                        "content": self.choices[0].message.content,
                    }
                }
            ],
            "usage": self.usage,
        }


class _FakeCompletions:
    def __init__(self, content: str):
        self.content = content

    async def create(self, **_kwargs):
        return _FakeResponse(self.content)


@pytest.mark.asyncio
async def test_llm_gateway_persists_full_request_and_response_audit_logs(monkeypatch):
    runtime_logs = []
    audit_logs = []

    async def _capture_runtime_log(**kwargs):
        runtime_logs.append(kwargs)

    async def _capture_audit_log(**kwargs):
        audit_logs.append(kwargs)

    monkeypatch.setattr(llm_gateway_module, "persist_runtime_log", _capture_runtime_log)
    monkeypatch.setattr(llm_gateway_module, "persist_run_audit_log", _capture_audit_log)

    gateway = LLMGateway(
        provider="litellm_proxy",
        base_url="http://localhost:4000",
        api_key="test-key",
        timeout_seconds=5,
    )
    gateway._client = type(
        "FakeClient",
        (),
        {
            "chat": type(
                "FakeChat",
                (),
                {"completions": _FakeCompletions('{"reply_to_user":{"content":"Hello"}}')},
            )()
        },
    )()

    result = await gateway.generate_text(
        model="helmos-default",
        system_prompt="system prompt text",
        user_prompt="user prompt text",
        temperature=0.2,
        metadata={
            "run_id": "run-123",
            "session_id": "session-456",
            "agent_key": "ideation",
        },
    )

    assert result == '{"reply_to_user":{"content":"Hello"}}'
    assert [entry["event_type"] for entry in audit_logs] == [
        "llm.completion_requested",
        "llm.completion_succeeded",
    ]
    requested = audit_logs[0]
    succeeded = audit_logs[1]
    assert requested["run_id"] == "run-123"
    assert requested["session_id"] == "session-456"
    assert requested["payload"]["request"]["messages"][0]["content"] == "system prompt text"
    assert requested["payload"]["request"]["messages"][1]["content"] == "user prompt text"
    assert succeeded["payload"]["response_content"] == '{"reply_to_user":{"content":"Hello"}}'
    assert succeeded["payload"]["response"]["choices"][0]["message"]["content"] == '{"reply_to_user":{"content":"Hello"}}'
    assert runtime_logs[0]["event"] == "llm_completion_requested"
    assert runtime_logs[1]["event"] == "llm_completion_succeeded"
