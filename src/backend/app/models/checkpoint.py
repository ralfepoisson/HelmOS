"""Workflow checkpoint persistence."""

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AgentCheckpoint(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Durable workflow checkpoint used for resume/replay."""

    __tablename__ = "agent_checkpoints"

    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), index=True, nullable=False)
    node_name: Mapped[str] = mapped_column(String(100), nullable=False)
    checkpoint_ref: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    state_payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    run = relationship("AgentRun", back_populates="checkpoints", foreign_keys=[run_id])
