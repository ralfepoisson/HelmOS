"""Approval persistence helpers."""

from datetime import datetime, timezone

from sqlalchemy import select

from app.models.approval import ApprovalRequest
from app.models.enums import ApprovalStatus
from app.repositories.base import SQLAlchemyRepository


class ApprovalRepository(SQLAlchemyRepository):
    """Persistence helpers for approval requests."""

    async def get_approval(self, approval_id: str) -> ApprovalRequest | None:
        return await self.get_by_id(ApprovalRequest, approval_id)

    async def get_pending_by_run(self, run_id: str) -> list[ApprovalRequest]:
        result = await self.session.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.run_id == run_id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
            )
        )
        return list(result.scalars().all())

    async def record_decision(
        self,
        approval: ApprovalRequest,
        *,
        approved: bool,
        decided_by: str,
        notes: str | None = None,
    ) -> ApprovalRequest:
        approval.status = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
        approval.decided_by = decided_by
        approval.decided_at = datetime.now(timezone.utc)
        approval.decision_notes = notes
        await self.session.flush()
        await self.session.refresh(approval)
        return approval
