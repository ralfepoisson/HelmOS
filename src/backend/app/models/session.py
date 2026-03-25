"""Session model for durable founder/workflow context."""

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Session(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A long-lived interaction context across multiple runs."""

    __tablename__ = "sessions"

    tenant_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    founder_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), default="Untitled session")
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    runs = relationship("AgentRun", back_populates="session", cascade="all, delete-orphan")
    domain_contexts = relationship(
        "DomainContext",
        back_populates="session",
        cascade="all, delete-orphan",
    )
