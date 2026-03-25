"""Agent registry and prompt configuration entities."""

from sqlalchemy import JSON, Boolean, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AgentDefinition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Registry entry for an agent implementation."""

    __tablename__ = "agent_definitions"
    __table_args__ = (Index("ix_agent_definitions_active", "active"),)

    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_tools: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    default_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PromptConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Versioned prompt and configuration registry."""

    __tablename__ = "prompt_configs"
    __table_args__ = (
        UniqueConstraint("key", "version", name="uq_prompt_configs_key_version"),
        Index("ix_prompt_configs_key_active", "key", "active"),
    )

    key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
