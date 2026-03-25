"""Audit logging service."""

from app.models.artifact import AuditLog
from app.repositories.run_repository import RunRepository


class AuditService:
    """Persist auditable events."""

    def __init__(self, run_repository: RunRepository):
        self.run_repository = run_repository

    async def log(
        self,
        *,
        event_type: str,
        actor: str = "system",
        run_id: str | None = None,
        session_id: str | None = None,
        payload: dict | None = None,
        message: str | None = None,
    ) -> AuditLog:
        audit_log = AuditLog(
            run_id=run_id,
            session_id=session_id,
            event_type=event_type,
            actor=actor,
            payload=payload or {},
            message=message,
        )
        return await self.run_repository.log_event(audit_log)
