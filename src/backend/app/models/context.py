"""Structured business/domain context entities."""

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.types import vector_type


class DomainContext(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Structured project or company context used by agents."""

    __tablename__ = "domain_contexts"

    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True, nullable=False)
    context_type: Mapped[str] = mapped_column(String(100), default="project")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    structured_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    session = relationship("Session", back_populates="domain_contexts")


class RetrievalDocument(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Embeddable retrieval material kept separate from business truth."""

    __tablename__ = "retrieval_documents"

    session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), index=True, nullable=True)
    source_uri: Mapped[str | None] = mapped_column(String(512), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)
    embedding: Mapped[list[float] | dict | None] = mapped_column(
        vector_type(1536),
        nullable=True,
    )
