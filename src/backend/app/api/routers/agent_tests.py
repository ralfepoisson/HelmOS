"""Agent test administration routes."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models.agent_test import (
    AgentTestAnnotation,
    AgentTestRun,
    AgentTestRunSnapshot,
    AgentTestScore,
    AgentTestTurn,
)
from app.repositories.agent_test_repository import AgentTestRepository
from app.schemas.agent_test import (
    AgentTestEvaluationResponse,
    AgentTestScoreSummary,
    FixtureListResponse,
    FixtureSummary,
    EvaluateTranscriptRequest,
)
from app.services.agent_test_fixtures import AgentTestFixtureRepository
from app.services.agent_test_reporting import AgentTestReportRenderer
from app.services.agent_test_rubrics import RubricRegistry
from app.services.agent_test_scoring import AgentTestScoringService


router = APIRouter()


@router.get("/fixtures", response_model=FixtureListResponse)
async def list_agent_test_fixtures() -> FixtureListResponse:
    """List available versioned agent-test fixtures."""

    repository = AgentTestFixtureRepository()
    fixtures = repository.list_fixtures()
    return FixtureListResponse(
        fixtures=[
            FixtureSummary(
                fixture_key=fixture.fixture_key,
                fixture_version=fixture.fixture_version,
                fixture_class=fixture.fixture_class,
                title=fixture.title,
                applicable_agents=fixture.applicable_agents,
                min_turns=fixture.min_turns,
                max_turns=fixture.max_turns,
                scenario_dimensions=fixture.scenario_dimensions,
                path=fixture.path,
            )
            for fixture in fixtures
        ]
    )


@router.post("/evaluate", response_model=AgentTestEvaluationResponse, status_code=status.HTTP_201_CREATED)
async def evaluate_agent_transcript(
    payload: EvaluateTranscriptRequest,
    db: AsyncSession = Depends(get_db_session),
) -> AgentTestEvaluationResponse:
    """Evaluate a completed transcript against a fixture and persist the result."""

    fixture_repository = AgentTestFixtureRepository()
    try:
        fixture = fixture_repository.load_fixture(payload.fixture_key, payload.fixture_version)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if payload.target_agent_key not in fixture.applicable_agents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fixture '{fixture.fixture_key}' is not applicable to agent '{payload.target_agent_key}'.",
        )

    rubric = RubricRegistry().get(
        payload.target_agent_key,
        fixture.scenario_dimensions,
        payload.rubric_version or fixture.rubric_version_hint,
    )
    scoring_service = AgentTestScoringService()
    annotations = scoring_service.generate_annotations(payload.transcript, payload.annotations)
    evaluation = scoring_service.evaluate(
        agent_key=payload.target_agent_key,
        rubric=rubric,
        transcript=payload.transcript,
        annotations=annotations,
        min_turns=fixture.min_turns,
    )

    repository = AgentTestRepository(db)
    run = await repository.create_run(
        AgentTestRun(
            suite_key=payload.suite_key,
            test_mode=payload.test_mode,
            target_agent_key=payload.target_agent_key,
            target_agent_version=payload.target_agent_version,
            target_model_name=payload.target_model_name,
            testing_agent_model_name=payload.testing_agent_model_name,
            fixture_key=fixture.fixture_key,
            fixture_version=fixture.fixture_version,
            rubric_version=rubric.version,
            driver_version=payload.driver_version or fixture.driver_version_hint,
            actual_turns=len(payload.transcript),
            min_turns=fixture.min_turns,
            overall_score=evaluation.overall_score,
            aggregate_confidence=evaluation.aggregate_confidence,
            verdict=evaluation.verdict,
            review_required=evaluation.review_required,
            summary=evaluation.summary,
            metadata_json=payload.metadata_json,
        )
    )

    identity_markdown = None
    if payload.identity_markdown_path:
        candidate = Path(payload.identity_markdown_path)
        if candidate.exists():
            identity_markdown = candidate.read_text(encoding="utf-8")

    snapshots = [
        AgentTestRunSnapshot(
            test_run_id=run.id,
            snapshot_type="fixture",
            source_ref=fixture.path,
            content_text=fixture.raw_markdown,
            content_json={"fixture_key": fixture.fixture_key, "fixture_version": fixture.fixture_version},
        ),
        AgentTestRunSnapshot(
            test_run_id=run.id,
            snapshot_type="rubric",
            source_ref=rubric.version,
            content_json={"version": rubric.version, "agent_key": payload.target_agent_key},
        ),
    ]
    if payload.composed_system_prompt:
        snapshots.append(
            AgentTestRunSnapshot(
                test_run_id=run.id,
                snapshot_type="composed_system_prompt",
                content_text=payload.composed_system_prompt,
                content_json={},
            )
        )
    if identity_markdown is not None:
        snapshots.append(
            AgentTestRunSnapshot(
                test_run_id=run.id,
                snapshot_type="identity_markdown",
                source_ref=payload.identity_markdown_path,
                content_text=identity_markdown,
                content_json={},
            )
        )
    for snapshot in snapshots:
        await repository.add_snapshot(snapshot)

    for turn in payload.transcript:
        await repository.add_turn(
            AgentTestTurn(
                test_run_id=run.id,
                turn_index=turn.turn_index,
                actor_type=turn.actor_type,
                message_role=turn.message_role,
                message_text=turn.message_text,
                structured_payload=turn.structured_payload,
                token_usage_json=turn.token_usage_json,
                metadata_json=turn.metadata_json,
            )
        )

    for annotation in annotations:
        await repository.add_annotation(
            AgentTestAnnotation(
                test_run_id=run.id,
                turn_index=annotation.turn_index,
                actor_type=annotation.actor_type,
                tag=annotation.tag,
                severity=annotation.severity,
                confidence=annotation.confidence,
                evidence_text=annotation.evidence_text,
                evidence_span=annotation.evidence_span,
                linked_scoring_dimensions=annotation.linked_scoring_dimensions,
                source_type=annotation.source_type,
                metadata_json=annotation.metadata_json,
            )
        )

    for score in evaluation.scores:
        await repository.add_score(
            AgentTestScore(
                test_run_id=run.id,
                layer_key=score.layer_key,
                dimension_key=score.dimension_key,
                raw_score=score.raw_score,
                normalized_score=score.normalized_score,
                weight_percent=score.weight_percent,
                blocking=score.blocking,
                blocking_threshold=score.blocking_threshold,
                confidence=score.confidence,
                evidence_turn_refs=score.evidence_turn_refs,
                metadata_json={},
            )
        )

    report_markdown = AgentTestReportRenderer().render_markdown(
        request=payload,
        fixture=fixture,
        evaluation=evaluation,
    )
    run.report_markdown = report_markdown
    run.report_json = {
        "hard_failures": evaluation.hard_failures,
        "quality_failures": evaluation.quality_failures,
        "missed_opportunities": evaluation.missed_opportunities,
        "summary": evaluation.summary,
    }
    await db.commit()
    await db.refresh(run)

    return AgentTestEvaluationResponse(
        run_id=run.id,
        fixture_key=fixture.fixture_key,
        fixture_version=fixture.fixture_version,
        target_agent_key=payload.target_agent_key,
        rubric_version=rubric.version,
        driver_version=payload.driver_version or fixture.driver_version_hint,
        overall_score=evaluation.overall_score,
        aggregate_confidence=evaluation.aggregate_confidence,
        verdict=evaluation.verdict,
        review_required=evaluation.review_required,
        summary=evaluation.summary,
        report_markdown=report_markdown,
        hard_failures=evaluation.hard_failures,
        quality_failures=evaluation.quality_failures,
        missed_opportunities=evaluation.missed_opportunities,
        scores=[
            AgentTestScoreSummary(
                layer_key=score.layer_key,
                dimension_key=score.dimension_key,
                raw_score=score.raw_score,
                normalized_score=score.normalized_score,
                weight_percent=score.weight_percent,
                blocking=score.blocking,
                blocking_threshold=score.blocking_threshold,
                confidence=score.confidence,
                evidence_turn_refs=score.evidence_turn_refs,
            )
            for score in evaluation.scores
        ],
        generated_annotations=annotations,
        created_at=run.created_at,
    )
