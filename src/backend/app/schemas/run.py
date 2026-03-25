"""Run lifecycle schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.agent import ArtifactPayload
from app.schemas.approval import ApprovalResponse
from app.schemas.common import APIModel


class SessionContextCreate(BaseModel):
    """Optional session payload when starting a run."""

    id: str | None = None
    title: str | None = None
    objective: str | None = None
    founder_id: str | None = None
    tenant_id: str | None = None
    metadata: dict = Field(default_factory=dict)


class StartRunRequest(BaseModel):
    """Create and start a run."""

    input_text: str
    request_type: str = "generic"
    requested_agent: str | None = None
    session: SessionContextCreate | None = None
    context: dict = Field(default_factory=dict)


class ResumeRunRequest(BaseModel):
    """Resume a previously paused run."""

    checkpoint_ref: str | None = None
    context_updates: dict = Field(default_factory=dict)


class RunStatusResponse(APIModel):
    """Primary run status payload."""

    id: str
    session_id: str
    status: str
    request_type: str
    requested_agent: str | None = None
    input_text: str
    checkpoint_ref: str | None = None
    current_checkpoint_id: str | None = None
    trace_reference: str | None = None
    error_message: str | None = None
    normalized_output: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class RunSummaryResponse(RunStatusResponse):
    """Extended summary including approvals and artifacts."""

    approvals: list[ApprovalResponse] = Field(default_factory=list)
    artifacts: list[ArtifactPayload] = Field(default_factory=list)
    history: list[dict] = Field(default_factory=list)


class RunHistoryEntry(APIModel):
    """Audit/history event for a run."""

    id: str
    event_type: str
    actor: str
    payload: dict = Field(default_factory=dict)
    message: str | None = None
    created_at: datetime


class RunHistoryResponse(BaseModel):
    """Run history payload."""

    run_id: str
    entries: list[RunHistoryEntry] = Field(default_factory=list)
