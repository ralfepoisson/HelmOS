"""Run model and persisted workflow state."""

from sqlalchemy import JSON, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import RunStatus


class AgentRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Represents a single execution attempt within a session."""

    __tablename__ = "agent_runs"

    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True, nullable=False)
    parent_run_id: Mapped[str | None] = mapped_column(ForeignKey("agent_runs.id"), nullable=True)
    status: Mapped[RunStatus] = mapped_column(
        Enum(RunStatus, name="run_status"),
        default=RunStatus.PENDING,
        nullable=False,
        index=True,
    )
    request_type: Mapped[str] = mapped_column(String(100), default="generic")
    requested_agent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_output: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    state_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    trace_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checkpoint_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_checkpoint_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_checkpoints.id"),
        nullable=True,
    )

    session = relationship("Session", back_populates="runs")
    checkpoints = relationship(
        "AgentCheckpoint",
        back_populates="run",
        foreign_keys="AgentCheckpoint.run_id",
        cascade="all, delete-orphan",
    )
    approvals = relationship(
        "ApprovalRequest",
        back_populates="run",
        cascade="all, delete-orphan",
    )
    artifacts = relationship("Artifact", back_populates="run", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="run", cascade="all, delete-orphan")
