"""Run, checkpoint, artifact, and audit persistence."""

from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from app.models.approval import ApprovalRequest
from app.models.artifact import Artifact, AuditLog
from app.models.checkpoint import AgentCheckpoint
from app.models.enums import RunStatus
from app.models.run import AgentRun
from app.repositories.base import SQLAlchemyRepository


class RunRepository(SQLAlchemyRepository):
    """Persistence helpers for agent runs."""

    async def create_run(self, run: AgentRun) -> AgentRun:
        return await self.add(run)

    async def get_run(self, run_id: str) -> AgentRun | None:
        result = await self.session.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id)
            .options(
                selectinload(AgentRun.approvals),
                selectinload(AgentRun.artifacts),
                selectinload(AgentRun.audit_logs),
                selectinload(AgentRun.checkpoints),
            )
        )
        return result.scalar_one_or_none()

    async def update_status(
        self,
        run: AgentRun,
        status: RunStatus,
        *,
        checkpoint_ref: str | None = None,
        error_message: str | None = None,
    ) -> AgentRun:
        run.status = status
        if checkpoint_ref is not None:
            run.checkpoint_ref = checkpoint_ref
        if error_message is not None:
            run.error_message = error_message
        await self.session.flush()
        await self.session.refresh(run)
        return run

    async def create_checkpoint(self, checkpoint: AgentCheckpoint) -> AgentCheckpoint:
        return await self.add(checkpoint)

    async def get_checkpoint_by_ref(self, checkpoint_ref: str) -> AgentCheckpoint | None:
        result = await self.session.execute(
            select(AgentCheckpoint).where(AgentCheckpoint.checkpoint_ref == checkpoint_ref)
        )
        return result.scalar_one_or_none()

    async def add_approval(self, approval: ApprovalRequest) -> ApprovalRequest:
        return await self.add(approval)

    async def add_artifact(self, artifact: Artifact) -> Artifact:
        return await self.add(artifact)

    async def log_event(self, audit_log: AuditLog) -> AuditLog:
        return await self.add(audit_log)

    async def get_history(self, run_id: str) -> list[AuditLog]:
        result = await self.session.execute(
            select(AuditLog)
            .where(AuditLog.run_id == run_id)
            .order_by(desc(AuditLog.created_at))
        )
        return list(result.scalars().all())
