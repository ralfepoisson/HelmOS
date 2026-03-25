"""Artifacts and audit entities."""

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ArtifactKind


class Artifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Structured or exported artefact produced by a run."""

    __tablename__ = "artifacts"

    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), index=True, nullable=False)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(100), default=ArtifactKind.GENERIC.value)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    storage_uri: Mapped[str | None] = mapped_column(String(512), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    run = relationship("AgentRun", back_populates="artifacts")


class AuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Auditable operational or agentic event."""

    __tablename__ = "audit_logs"

    run_id: Mapped[str | None] = mapped_column(ForeignKey("agent_runs.id"), index=True, nullable=True)
    session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), index=True, nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), default="system")
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    run = relationship("AgentRun", back_populates="audit_logs")
