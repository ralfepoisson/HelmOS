"""Approval lifecycle routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models.enums import ApprovalStatus, RunStatus
from app.repositories.approval_repository import ApprovalRepository
from app.repositories.run_repository import RunRepository
from app.schemas.approval import ApprovalDecisionRequest, ApprovalResponse


router = APIRouter()


@router.post("/{approval_id}/decision", response_model=ApprovalResponse)
async def decide_approval(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ApprovalResponse:
    """Approve or reject a pending approval request."""

    approval_repository = ApprovalRepository(db)
    run_repository = RunRepository(db)
    approval = await approval_repository.get_approval(approval_id)
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=409, detail="Approval request has already been decided.")

    approval = await approval_repository.record_decision(
        approval,
        approved=payload.approved,
        decided_by=payload.decided_by,
        notes=payload.notes,
    )
    run = await run_repository.get_run(approval.run_id)
    if not payload.approved:
        run.status = RunStatus.CANCELLED
    await db.commit()
    return ApprovalResponse.model_validate(approval)
