"""Approval-related schemas."""

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ApprovalDecisionRequest(APIModel):
    """Approve or reject a pending checkpoint."""

    approved: bool
    decided_by: str
    notes: str | None = None


class ApprovalResponse(APIModel):
    """API-facing approval request representation."""

    id: str
    run_id: str
    action_type: str
    rationale: str | None = None
    requested_payload: str | None = None
    status: str
    requested_by: str
    decided_by: str | None = None
    decided_at: datetime | None = None
    decision_notes: str | None = None


class ApprovalCheckpoint(APIModel):
    """Persisted approval checkpoint information used by orchestration."""

    run_id: str
    checkpoint_ref: str
    action_type: str
    rationale: str | None = None
    requested_payload: dict = Field(default_factory=dict)
