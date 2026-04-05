"""Schemas for agent testing APIs and services."""

from datetime import datetime

from pydantic import BaseModel, Field


class FixtureSummary(BaseModel):
    fixture_key: str
    fixture_version: str
    fixture_class: str
    title: str
    applicable_agents: list[str] = Field(default_factory=list)
    min_turns: int = 20
    max_turns: int = 30
    scenario_dimensions: list[str] = Field(default_factory=list)
    path: str


class FixtureListResponse(BaseModel):
    fixtures: list[FixtureSummary] = Field(default_factory=list)


class CreateAgentTestRunRequest(BaseModel):
    target_agent_key: str
    fixture_key: str
    fixture_version: str | None = None
    test_mode: str = "single_agent_benchmark"
    suite_key: str | None = None
    target_model_name: str | None = None
    testing_agent_model_name: str | None = None
    operator_notes: str | None = None


class AgentTestRunSummaryResponse(BaseModel):
    id: str
    suite_key: str | None = None
    test_mode: str
    target_agent_key: str
    target_agent_version: str | None = None
    target_model_name: str | None = None
    testing_agent_model_name: str | None = None
    fixture_key: str
    fixture_version: str
    rubric_version: str
    driver_version: str
    status: str
    actual_turns: int
    min_turns: int
    overall_score: float
    aggregate_confidence: float
    verdict: str
    review_required: bool
    summary: str | None = None
    operator_notes: str | None = None
    created_at: datetime
    updated_at: datetime


class AgentTestRunListResponse(BaseModel):
    runs: list[AgentTestRunSummaryResponse] = Field(default_factory=list)


class AgentTestRunDetailResponse(AgentTestRunSummaryResponse):
    report_markdown: str | None = None
    report_json: dict = Field(default_factory=dict)
    metadata_json: dict = Field(default_factory=dict)
    snapshots: list["AgentTestRunSnapshotResponse"] = Field(default_factory=list)
    turns: list["AgentTestTurnResponse"] = Field(default_factory=list)
    annotations: list["AgentTestAnnotationResponse"] = Field(default_factory=list)
    scores: list["AgentTestScoreResponse"] = Field(default_factory=list)


class AgentTestRunSnapshotResponse(BaseModel):
    id: str
    snapshot_type: str
    source_ref: str | None = None
    checksum: str | None = None
    created_at: datetime
    content_text: str | None = None
    content_json: dict = Field(default_factory=dict)


class AgentTestTurnResponse(BaseModel):
    id: str
    turn_index: int
    actor_type: str
    message_role: str
    message_text: str
    structured_payload: dict = Field(default_factory=dict)
    token_usage_json: dict = Field(default_factory=dict)
    metadata_json: dict = Field(default_factory=dict)
    created_at: datetime


class AgentTestAnnotationResponse(BaseModel):
    id: str
    turn_index: int
    actor_type: str
    tag: str
    severity: str = "medium"
    confidence: float = 0.5
    evidence_text: str | None = None
    evidence_span: dict = Field(default_factory=dict)
    linked_scoring_dimensions: list[str] = Field(default_factory=list)
    source_type: str = "human_reviewer"
    metadata_json: dict = Field(default_factory=dict)
    created_at: datetime


class AgentTestScoreResponse(BaseModel):
    id: str
    layer_key: str
    dimension_key: str
    raw_score: int
    normalized_score: float
    weight_percent: float
    blocking: bool
    blocking_threshold: int | None = None
    confidence: float
    evidence_turn_refs: list[int] = Field(default_factory=list)
    metadata_json: dict = Field(default_factory=dict)
    created_at: datetime


class AgentTestTurnInput(BaseModel):
    turn_index: int
    actor_type: str
    message_role: str
    message_text: str
    structured_payload: dict = Field(default_factory=dict)
    token_usage_json: dict = Field(default_factory=dict)
    metadata_json: dict = Field(default_factory=dict)


class AgentTestAnnotationInput(BaseModel):
    turn_index: int
    actor_type: str
    tag: str
    severity: str = "medium"
    confidence: float = 0.5
    evidence_text: str | None = None
    evidence_span: dict = Field(default_factory=dict)
    linked_scoring_dimensions: list[str] = Field(default_factory=list)
    source_type: str = "human_reviewer"
    metadata_json: dict = Field(default_factory=dict)


class EvaluateTranscriptRequest(BaseModel):
    test_mode: str = "single_agent_benchmark"
    suite_key: str | None = None
    target_agent_key: str
    target_agent_version: str | None = None
    target_model_name: str | None = None
    testing_agent_model_name: str | None = None
    fixture_key: str
    fixture_version: str | None = None
    rubric_version: str | None = None
    driver_version: str | None = None
    identity_markdown_path: str | None = None
    composed_system_prompt: str | None = None
    transcript: list[AgentTestTurnInput]
    annotations: list[AgentTestAnnotationInput] = Field(default_factory=list)
    metadata_json: dict = Field(default_factory=dict)


class AgentTestScoreSummary(BaseModel):
    layer_key: str
    dimension_key: str
    raw_score: int
    normalized_score: float
    weight_percent: float
    blocking: bool
    blocking_threshold: int | None = None
    confidence: float
    evidence_turn_refs: list[int] = Field(default_factory=list)


class AgentTestEvaluationResponse(BaseModel):
    run_id: str
    fixture_key: str
    fixture_version: str
    target_agent_key: str
    rubric_version: str
    driver_version: str
    overall_score: float
    aggregate_confidence: float
    verdict: str
    review_required: bool
    summary: str | None = None
    report_markdown: str | None = None
    hard_failures: list[dict] = Field(default_factory=list)
    quality_failures: list[dict] = Field(default_factory=list)
    missed_opportunities: list[dict] = Field(default_factory=list)
    scores: list[AgentTestScoreSummary] = Field(default_factory=list)
    generated_annotations: list[AgentTestAnnotationInput] = Field(default_factory=list)
    created_at: datetime
