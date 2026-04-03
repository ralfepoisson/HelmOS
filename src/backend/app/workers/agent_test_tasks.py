"""Background processing for queued agent test runs."""

from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

import structlog

from app.api.deps import build_specialist_registry
from app.models.agent_test import AgentTestAnnotation, AgentTestRunSnapshot, AgentTestScore, AgentTestTurn
from app.repositories.agent_test_repository import AgentTestRepository
from app.repositories.registry_repository import RegistryRepository
from app.services.agent_test_execution import AgentTestExecutionService, AgentTestExecutionStopped
from app.services.agent_test_fixtures import AgentTestFixtureRepository
from app.services.agent_test_rubrics import RubricRegistry


logger = structlog.get_logger(__name__)


def _checksum_text(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def _resolve_identity_markdown_path(agent_key: str) -> Path | None:
    repo_root = Path(__file__).resolve().parents[4]
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


async def process_agent_test_run(session, settings, run_id: str) -> None:
    """Execute one queued agent test run."""

    repository = AgentTestRepository(session)
    run = await repository.get_run(run_id)
    if run is None:
        raise LookupError(f"Agent test run '{run_id}' not found.")
    if run.status not in {"queued", "draft", "failed"}:
        logger.info("agent_test_run.skipped", run_id=run_id, status=run.status)
        return

    registry_repository = RegistryRepository(session)
    agent_definition = await registry_repository.get_agent_definition(run.target_agent_key)
    if agent_definition is None or not agent_definition.active:
        run.status = "failed"
        run.summary = f"Unknown active target agent '{run.target_agent_key}'."
        await session.commit()
        return

    prompt_config = await registry_repository.get_prompt_config_for_agent(run.target_agent_key)
    specialist_registry = build_specialist_registry(
        settings,
        registry_repository=registry_repository,
    )
    runtime_agent = await specialist_registry.get(run.target_agent_key)
    fixture_repository = AgentTestFixtureRepository()
    fixture = fixture_repository.load_fixture(run.fixture_key, run.fixture_version)
    rubric = RubricRegistry().get(
        run.target_agent_key,
        fixture.scenario_dimensions,
        run.rubric_version,
    )
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
                source_ref=str(identity_path.relative_to(Path(__file__).resolve().parents[4])),
                checksum=_checksum_text(identity_text),
                content_text=identity_text,
                content_json={},
            )
        )

    run.status = "running"
    run.summary = "Execution started. The specialist runtime is producing a transcript for evaluation."
    run.metadata_json = {
        **(run.metadata_json or {}),
        "execution_requested": True,
    }
    await session.commit()
    await session.refresh(run)

    try:
        await repository.clear_execution_artifacts(run.id)
        execution = await AgentTestExecutionService().execute(
            run=run,
            fixture=fixture,
            rubric=rubric,
            runtime_agent=runtime_agent,
            identity_markdown_path=str(identity_path) if identity_path is not None else None,
        )
        for turn in execution.turns:
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
        for annotation in execution.annotations:
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
        for score in execution.scores:
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
        await session.commit()
        await session.refresh(run)
        logger.info("agent_test_run.completed", run_id=run.id, verdict=run.verdict)
    except Exception as exc:  # pragma: no cover - defensive operational path
        logger.exception("agent_test_run.failed", run_id=run.id, error=str(exc))
        run.status = "failed"
        run.summary = f"Execution failed: {exc}"
        run.metadata_json = {
            **(run.metadata_json or {}),
            "execution_error": str(exc),
        }
        await session.commit()
        await session.refresh(run)


async def run_agent_test_worker(session_factory, settings, stop_event: asyncio.Event, control_events: dict[str, asyncio.Event]) -> None:
    """Poll and execute queued agent test runs until shutdown."""

    poll_seconds = max(0.5, float(settings.agent_test_worker_poll_seconds))
    while not stop_event.is_set():
        try:
            async with session_factory() as session:
                repository = AgentTestRepository(session)
                queued_runs = await repository.list_runs_by_status("queued", limit=5)
                for queued_run in queued_runs:
                    if stop_event.is_set():
                        break
                    run_stop_event = control_events.setdefault(queued_run.id, asyncio.Event())
                    try:
                        await process_agent_test_run_with_control(
                            session,
                            settings,
                            queued_run.id,
                            run_stop_event=run_stop_event,
                        )
                    finally:
                        control_events.pop(queued_run.id, None)
        except asyncio.CancelledError:  # pragma: no cover - shutdown path
            raise
        except Exception as exc:  # pragma: no cover - defensive operational path
            logger.exception("agent_test_worker.poll_failed", error=str(exc))

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_seconds)
        except asyncio.TimeoutError:
            continue


async def process_agent_test_run_with_control(
    session,
    settings,
    run_id: str,
    *,
    run_stop_event: asyncio.Event,
) -> None:
    """Execute one queued agent test run with cooperative stop support."""

    repository = AgentTestRepository(session)
    run = await repository.get_run(run_id)
    if run is None:
        raise LookupError(f"Agent test run '{run_id}' not found.")
    if run.status not in {"queued", "draft", "failed"}:
        logger.info("agent_test_run.skipped", run_id=run_id, status=run.status)
        return

    registry_repository = RegistryRepository(session)
    agent_definition = await registry_repository.get_agent_definition(run.target_agent_key)
    if agent_definition is None or not agent_definition.active:
        run.status = "failed"
        run.summary = f"Unknown active target agent '{run.target_agent_key}'."
        await session.commit()
        return

    prompt_config = await registry_repository.get_prompt_config_for_agent(run.target_agent_key)
    specialist_registry = build_specialist_registry(
        settings,
        registry_repository=registry_repository,
    )
    runtime_agent = await specialist_registry.get(run.target_agent_key)
    fixture_repository = AgentTestFixtureRepository()
    fixture = fixture_repository.load_fixture(run.fixture_key, run.fixture_version)
    rubric = RubricRegistry().get(
        run.target_agent_key,
        fixture.scenario_dimensions,
        run.rubric_version,
    )
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
                source_ref=str(identity_path.relative_to(Path(__file__).resolve().parents[4])),
                checksum=_checksum_text(identity_text),
                content_text=identity_text,
                content_json={},
            )
        )

    run.status = "running"
    run.summary = "Execution started. The specialist runtime is producing a transcript for evaluation."
    run.metadata_json = {
        **(run.metadata_json or {}),
        "execution_requested": True,
        "stop_requested": False,
    }
    await session.commit()
    await session.refresh(run)

    try:
        await repository.clear_execution_artifacts(run.id)
        execution = await AgentTestExecutionService().execute(
            run=run,
            fixture=fixture,
            rubric=rubric,
            runtime_agent=runtime_agent,
            identity_markdown_path=str(identity_path) if identity_path is not None else None,
            stop_event=run_stop_event,
        )
        for turn in execution.turns:
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
        for annotation in execution.annotations:
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
        for score in execution.scores:
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
        await session.commit()
        await session.refresh(run)
        logger.info("agent_test_run.completed", run_id=run.id, verdict=run.verdict)
    except AgentTestExecutionStopped:
        run.status = "stopped"
        run.summary = "Execution stopped by operator."
        run.metadata_json = {
            **(run.metadata_json or {}),
            "execution_stopped_manually": True,
            "stop_requested": False,
        }
        await session.commit()
        await session.refresh(run)
        logger.info("agent_test_run.stopped", run_id=run.id)
    except Exception as exc:  # pragma: no cover - defensive operational path
        logger.exception("agent_test_run.failed", run_id=run.id, error=str(exc))
        run.status = "failed"
        run.summary = f"Execution failed: {exc}"
        run.metadata_json = {
            **(run.metadata_json or {}),
            "execution_error": str(exc),
            "stop_requested": False,
        }
        await session.commit()
        await session.refresh(run)
