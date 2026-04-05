"""Agent testing ORM models."""

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AgentTestRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Top-level record for one evaluation run."""

    __tablename__ = "agent_test_runs"

    target_agent_run_root_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_runs.id"),
        nullable=True,
        index=True,
    )
    suite_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    test_mode: Mapped[str] = mapped_column(String(100), nullable=False, default="single_agent_benchmark")
    target_agent_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_agent_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    testing_agent_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fixture_key: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    fixture_version: Mapped[str] = mapped_column(String(50), nullable=False)
    rubric_version: Mapped[str] = mapped_column(String(100), nullable=False)
    driver_version: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="completed")
    actual_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    aggregate_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    verdict: Mapped[str] = mapped_column(String(50), nullable=False, default="REVIEW_REQUIRED")
    review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AgentTestFixtureRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Database-backed registry record for one test fixture version."""

    __tablename__ = "agent_test_fixtures"

    fixture_key: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    fixture_version: Mapped[str] = mapped_column(String(50), nullable=False)
    fixture_class: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    applicable_agents: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    rubric_version_hint: Mapped[str] = mapped_column(String(100), nullable=False)
    driver_version_hint: Mapped[str] = mapped_column(String(100), nullable=False)
    min_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    max_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    scenario_dimensions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    primary_goal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    raw_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    sections: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    revealable_facts: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    blocked_facts: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    __table_args__ = (
        {"sqlite_autoincrement": False},
    )


class AgentTestRunSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Immutable snapshot content used by a test run."""

    __tablename__ = "agent_test_run_snapshots"

    test_run_id: Mapped[str] = mapped_column(ForeignKey("agent_test_runs.id"), nullable=False, index=True)
    snapshot_type: Mapped[str] = mapped_column(String(100), nullable=False)
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AgentTestTurn(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One turn in an evaluation transcript."""

    __tablename__ = "agent_test_turns"

    test_run_id: Mapped[str] = mapped_column(ForeignKey("agent_test_runs.id"), nullable=False, index=True)
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message_role: Mapped[str] = mapped_column(String(50), nullable=False)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    token_usage_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AgentTestAnnotation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Annotation attached to a run turn."""

    __tablename__ = "agent_test_annotations"

    test_run_id: Mapped[str] = mapped_column(ForeignKey("agent_test_runs.id"), nullable=False, index=True)
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    tag: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    evidence_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_span: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    linked_scoring_dimensions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="deterministic")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AgentTestScore(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-dimension score for a run."""

    __tablename__ = "agent_test_scores"

    test_run_id: Mapped[str] = mapped_column(ForeignKey("agent_test_runs.id"), nullable=False, index=True)
    layer_key: Mapped[str] = mapped_column(String(50), nullable=False)
    dimension_key: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_score: Mapped[int] = mapped_column(Integer, nullable=False)
    normalized_score: Mapped[float] = mapped_column(Float, nullable=False)
    weight_percent: Mapped[float] = mapped_column(Float, nullable=False)
    blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    blocking_threshold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    evidence_turn_refs: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
