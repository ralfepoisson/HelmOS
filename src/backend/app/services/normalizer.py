"""Structured output normalization."""

from app.schemas.agent import AgentExecutionOutput


class StructuredOutputNormalizer:
    """Convert agent payloads into a stable artifact-oriented shape."""

    def normalize(self, output: AgentExecutionOutput) -> dict:
        artifact = output.artifact.model_dump()
        return {
            "agent_key": output.agent_key,
            "version": output.version,
            "artifact": artifact,
            "intermediate_notes": output.intermediate_notes,
            "citations": output.citations,
            "next_actions": output.next_actions,
            "requires_approval": output.requires_approval,
            "approval_reason": output.approval_reason,
            "requested_tools": output.requested_tools,
        }
