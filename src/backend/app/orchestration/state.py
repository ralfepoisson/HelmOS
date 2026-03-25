"""Workflow state types."""

from typing import Any, Literal, TypedDict


RouteType = Literal["deterministic", "agent", "workflow"]


class WorkflowState(TypedDict, total=False):
    run_id: str
    session_id: str
    input_text: str
    request_type: str
    requested_agent: str | None
    route: RouteType
    selected_agent: str | None
    history: list[dict[str, Any]]
    working_memory: dict[str, Any]
    normalized_output: dict[str, Any]
    policy_result: dict[str, Any]
    approval_required: bool
    approval_id: str | None
    checkpoint_ref: str | None
    error_message: str | None
