"""Agent test administration routes."""

import hashlib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_settings
from app.config.settings import Settings
from app.models.agent_test import AgentTestRun, AgentTestRunSnapshot
from app.repositories.registry_repository import RegistryRepository
from app.repositories.agent_test_repository import AgentTestRepository
from app.schemas.common import StatusResponse
from app.schemas.agent_test import (
    AgentTestRunDetailResponse,
    AgentTestRunListResponse,
    AgentTestRunSummaryResponse,
    AgentTestEvaluationResponse,
    AgentTestScoreSummary,
    CreateAgentTestRunRequest,
    FixtureListResponse,
    FixtureSummary,
    EvaluateTranscriptRequest,
)
from app.services.agent_test_fixtures import AgentTestFixtureRepository
from app.services.agent_test_reporting import AgentTestReportRenderer
from app.services.agent_test_rubrics import RubricRegistry
from app.services.agent_test_scoring import AgentTestScoringService


router = APIRouter()


def _to_run_summary(run: AgentTestRun) -> AgentTestRunSummaryResponse:
    return AgentTestRunSummaryResponse(
        id=run.id,
        suite_key=run.suite_key,
        test_mode=run.test_mode,
        target_agent_key=run.target_agent_key,
        target_agent_version=run.target_agent_version,
        target_model_name=run.target_model_name,
        testing_agent_model_name=run.testing_agent_model_name,
        fixture_key=run.fixture_key,
        fixture_version=run.fixture_version,
        rubric_version=run.rubric_version,
        driver_version=run.driver_version,
        status=run.status,
        actual_turns=run.actual_turns,
        min_turns=run.min_turns,
        overall_score=run.overall_score,
        aggregate_confidence=run.aggregate_confidence,
        verdict=run.verdict,
        review_required=run.review_required,
        summary=run.summary,
        operator_notes=(run.metadata_json or {}).get("operator_notes"),
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _resolve_identity_markdown_path(agent_key: str) -> Path | None:
    repo_root = Path(__file__).resolve().parents[5]
    docs_dir = repo_root / "docs" / "agents"
    normalized = agent_key.replace("-", "_")
    candidates = [
        docs_dir / f"{normalized}_agent.md",
        docs_dir / f"{agent_key}_agent.md",
        docs_dir / f"{normalized}.md",
        docs_dir / f"{agent_key}.md",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


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


@router.get("/runs", response_model=AgentTestRunListResponse)
async def list_agent_test_runs(
    target_agent_key: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> AgentTestRunListResponse:
    """List configured or executed agent-test runs."""

    repository = AgentTestRepository(db)
    runs = (
        await repository.list_runs_for_agent(target_agent_key)
        if target_agent_key
        else await repository.list_runs()
    )
    return AgentTestRunListResponse(runs=[_to_run_summary(run) for run in runs])


@router.post("/runs", response_model=AgentTestRunSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_test_run(
    payload: CreateAgentTestRunRequest,
    db: AsyncSession = Depends(get_db_session),
) -> AgentTestRunSummaryResponse:
    """Create a configured draft test run without executing it."""

    fixture_repository = AgentTestFixtureRepository()
    registry_repository = RegistryRepository(db)

    try:
        fixture = fixture_repository.load_fixture(payload.fixture_key, payload.fixture_version)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    agent_definition = await registry_repository.get_agent_definition(payload.target_agent_key)
    if agent_definition is None or not agent_definition.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown active target agent '{payload.target_agent_key}'.",
        )

    if payload.target_agent_key not in fixture.applicable_agents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fixture '{fixture.fixture_key}' is not applicable to agent '{payload.target_agent_key}'.",
        )

    rubric = RubricRegistry().get(
        payload.target_agent_key,
        fixture.scenario_dimensions,
        fixture.rubric_version_hint,
    )
    repository = AgentTestRepository(db)
    run = await repository.create_run(
        AgentTestRun(
            suite_key=payload.suite_key,
            test_mode=payload.test_mode,
            target_agent_key=payload.target_agent_key,
            target_agent_version=agent_definition.version,
            target_model_name=payload.target_model_name or agent_definition.default_model,
            testing_agent_model_name=payload.testing_agent_model_name,
            fixture_key=fixture.fixture_key,
            fixture_version=fixture.fixture_version,
            rubric_version=rubric.version,
            driver_version=fixture.driver_version_hint,
            status="draft",
            actual_turns=0,
            min_turns=fixture.min_turns,
            overall_score=0.0,
            aggregate_confidence=0.0,
            verdict="PENDING",
            review_required=False,
            summary="Configured and ready to run.",
            metadata_json={"operator_notes": payload.operator_notes or ""},
        )
    )
    await repository.add_snapshot(
        AgentTestRunSnapshot(
            test_run_id=run.id,
            snapshot_type="fixture",
            source_ref=fixture.path,
            checksum=_checksum_text(fixture.raw_markdown),
            content_text=fixture.raw_markdown,
            content_json={"fixture_key": fixture.fixture_key, "fixture_version": fixture.fixture_version},
        )
    )
    await repository.add_snapshot(
        AgentTestRunSnapshot(
            test_run_id=run.id,
            snapshot_type="rubric",
            source_ref=rubric.version,
            checksum=_checksum_text(rubric.version),
            content_json={"version": rubric.version, "agent_key": payload.target_agent_key},
        )
    )
    await db.commit()
    await db.refresh(run)
    return _to_run_summary(run)


@router.get("/runs/{run_id}", response_model=AgentTestRunDetailResponse)
async def get_agent_test_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> AgentTestRunDetailResponse:
    """Return detail for one configured or executed test run."""

    repository = AgentTestRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent test run not found.")
    snapshots = await repository.list_snapshots_for_run(run_id)
    summary = _to_run_summary(run)
    return AgentTestRunDetailResponse(
        **summary.model_dump(),
        report_markdown=run.report_markdown,
        report_json=run.report_json or {},
        metadata_json=run.metadata_json or {},
        snapshots=[
            {
                "id": snapshot.id,
                "snapshot_type": snapshot.snapshot_type,
                "source_ref": snapshot.source_ref,
                "checksum": snapshot.checksum,
                "created_at": snapshot.created_at,
            }
            for snapshot in snapshots
        ],
    )


@router.post("/runs/{run_id}/execute", response_model=AgentTestRunDetailResponse)
async def execute_agent_test_run(
    run_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AgentTestRunDetailResponse:
    """Queue a configured run for background execution and capture immutable runtime snapshots."""

    repository = AgentTestRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent test run not found.")
    if run.status not in {"draft", "failed", "queued"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run cannot be executed from status '{run.status}'.",
        )

    registry_repository = RegistryRepository(db)
    agent_definition = await registry_repository.get_agent_definition(run.target_agent_key)
    if agent_definition is None or not agent_definition.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown active target agent '{run.target_agent_key}'.",
        )
    prompt_config = await registry_repository.get_prompt_config_for_agent(run.target_agent_key)
    identity_path = _resolve_identity_markdown_path(run.target_agent_key)
    existing_snapshot_types = {snapshot.snapshot_type for snapshot in await repository.list_snapshots_for_run(run.id)}

    if "agent_definition" not in existing_snapshot_types:
        agent_definition_json = {
            "key": agent_definition.key,
            "name": agent_definition.name,
            "version": agent_definition.version,
            "description": agent_definition.description,
            "allowed_tools": list(agent_definition.allowed_tools or []),
            "default_model": agent_definition.default_model,
        }
        await repository.add_snapshot(
            AgentTestRunSnapshot(
                test_run_id=run.id,
                snapshot_type="agent_definition",
                source_ref=agent_definition.key,
                checksum=_checksum_text(str(agent_definition_json)),
                content_json=agent_definition_json,
            )
        )

    if prompt_config is not None and "prompt_config" not in existing_snapshot_types:
        await repository.add_snapshot(
            AgentTestRunSnapshot(
                test_run_id=run.id,
                snapshot_type="prompt_config",
                source_ref=prompt_config.key,
                checksum=_checksum_text(prompt_config.prompt_template),
                content_text=prompt_config.prompt_template,
                content_json={"version": prompt_config.version, "config_json": prompt_config.config_json},
            )
        )

    if "composed_system_prompt" not in existing_snapshot_types:
        from app.api.deps import build_specialist_registry

        specialist_registry = build_specialist_registry(
            settings,
            registry_repository=registry_repository,
        )
        runtime_agent = await specialist_registry.get(run.target_agent_key)
        await repository.add_snapshot(
            AgentTestRunSnapshot(
                test_run_id=run.id,
                snapshot_type="composed_system_prompt",
                source_ref=run.target_agent_key,
                checksum=_checksum_text(runtime_agent.system_prompt),
                content_text=runtime_agent.system_prompt,
                content_json={},
            )
        )

    if identity_path is not None and "identity_markdown" not in existing_snapshot_types:
        identity_text = identity_path.read_text(encoding="utf-8")
        await repository.add_snapshot(
            AgentTestRunSnapshot(
                test_run_id=run.id,
                snapshot_type="identity_markdown",
                source_ref=str(identity_path.relative_to(Path(__file__).resolve().parents[5])),
                checksum=_checksum_text(identity_text),
                content_text=identity_text,
                content_json={},
            )
        )

    run.status = "queued"
    run.actual_turns = 0
    run.overall_score = 0.0
    run.aggregate_confidence = 0.0
    run.verdict = "PENDING"
    run.review_required = False
    run.report_markdown = None
    run.report_json = {}
    run.summary = "Execution requested. The run is queued for background execution."
    run.metadata_json = {
        **(run.metadata_json or {}),
        "execution_requested": True,
        "queued_for_execution": True,
    }
    await db.commit()
    await db.refresh(run)

    snapshots = await repository.list_snapshots_for_run(run.id)
    summary = _to_run_summary(run)
    return AgentTestRunDetailResponse(
        **summary.model_dump(),
        report_markdown=run.report_markdown,
        report_json=run.report_json or {},
        metadata_json=run.metadata_json or {},
        snapshots=[
            {
                "id": snapshot.id,
                "snapshot_type": snapshot.snapshot_type,
                "source_ref": snapshot.source_ref,
                "checksum": snapshot.checksum,
                "created_at": snapshot.created_at,
            }
            for snapshot in snapshots
        ],
    )


@router.post("/runs/{run_id}/stop", response_model=AgentTestRunDetailResponse)
async def stop_agent_test_run(
    run_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> AgentTestRunDetailResponse:
    """Request that a queued or running test stop."""

    repository = AgentTestRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent test run not found.")

    if run.status == "queued":
        run.status = "stopped"
        run.summary = "Execution stopped before the worker started the run."
        run.metadata_json = {
            **(run.metadata_json or {}),
            "execution_stopped_manually": True,
            "stop_requested": False,
        }
    elif run.status == "running":
        control_events = getattr(request.app.state, "agent_test_control_events", {})
        control_event = control_events.get(run_id)
        if control_event is not None:
            control_event.set()
        run.status = "stopping"
        run.summary = "Stop requested. Waiting for the current agent call to finish."
        run.metadata_json = {
            **(run.metadata_json or {}),
            "stop_requested": True,
        }
    elif run.status == "stopping":
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run cannot be stopped from status '{run.status}'.",
        )

    await db.commit()
    await db.refresh(run)
    snapshots = await repository.list_snapshots_for_run(run.id)
    summary = _to_run_summary(run)
    return AgentTestRunDetailResponse(
        **summary.model_dump(),
        report_markdown=run.report_markdown,
        report_json=run.report_json or {},
        metadata_json=run.metadata_json or {},
        snapshots=[
            {
                "id": snapshot.id,
                "snapshot_type": snapshot.snapshot_type,
                "source_ref": snapshot.source_ref,
                "checksum": snapshot.checksum,
                "created_at": snapshot.created_at,
            }
            for snapshot in snapshots
        ],
    )


@router.post("/runs/{run_id}/resume", response_model=AgentTestRunDetailResponse)
async def resume_agent_test_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> AgentTestRunDetailResponse:
    """Resume a previously stopped test by re-queueing it."""

    repository = AgentTestRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent test run not found.")
    if run.status not in {"stopped", "failed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run cannot be resumed from status '{run.status}'.",
        )

    run.status = "queued"
    run.actual_turns = 0
    run.overall_score = 0.0
    run.aggregate_confidence = 0.0
    run.verdict = "PENDING"
    run.review_required = False
    run.report_markdown = None
    run.report_json = {}
    run.summary = "Execution re-queued. The worker will resume the test from the beginning."
    run.metadata_json = {
        **(run.metadata_json or {}),
        "execution_stopped_manually": False,
        "stop_requested": False,
        "resume_requested": True,
    }
    await db.commit()
    await db.refresh(run)
    snapshots = await repository.list_snapshots_for_run(run.id)
    summary = _to_run_summary(run)
    return AgentTestRunDetailResponse(
        **summary.model_dump(),
        report_markdown=run.report_markdown,
        report_json=run.report_json or {},
        metadata_json=run.metadata_json or {},
        snapshots=[
            {
                "id": snapshot.id,
                "snapshot_type": snapshot.snapshot_type,
                "source_ref": snapshot.source_ref,
                "checksum": snapshot.checksum,
                "created_at": snapshot.created_at,
            }
            for snapshot in snapshots
        ],
    )


@router.delete("/runs/{run_id}", response_model=StatusResponse)
async def delete_agent_test_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> StatusResponse:
    """Delete a test run configuration and its associated evaluation records."""

    repository = AgentTestRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent test run not found.")
    if run.status == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A running test run cannot be deleted.",
        )

    await repository.delete_run(run_id)
    await db.commit()
    return StatusResponse(status="deleted", detail="Agent test run configuration deleted.")


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
