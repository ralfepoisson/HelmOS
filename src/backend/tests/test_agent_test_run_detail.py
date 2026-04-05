from datetime import UTC, datetime

from app.api.routers.agent_tests import _build_run_detail_response
from app.models.agent_test import (
    AgentTestAnnotation,
    AgentTestRun,
    AgentTestRunSnapshot,
    AgentTestScore,
    AgentTestTurn,
)


def test_build_run_detail_response_includes_transcript_and_artifacts():
    created_at = datetime(2026, 4, 3, 9, 26, 34, tzinfo=UTC)
    updated_at = datetime(2026, 4, 3, 10, 34, 43, tzinfo=UTC)
    run = AgentTestRun(
        id="run-1",
        suite_key=None,
        test_mode="single_agent_benchmark",
        target_agent_key="ideation",
        target_agent_version="1.0.0",
        target_model_name="helmos-default",
        testing_agent_model_name=None,
        fixture_key="saas_b2b_finops_assistant",
        fixture_version="1.0.0",
        rubric_version="ideation-core-v1",
        driver_version="scenario-driver-v1",
        status="completed",
        actual_turns=4,
        min_turns=20,
        overall_score=56.88,
        aggregate_confidence=0.3,
        verdict="REVIEW_REQUIRED",
        review_required=True,
        summary="ideation scored 56.88 with verdict REVIEW_REQUIRED.",
        report_markdown="# Agent Test Report",
        report_json={
            "summary": "Detected contradiction risk.",
            "hard_failures": [],
            "quality_failures": [{"message": "Too little customer evidence."}],
            "missed_opportunities": [],
        },
        metadata_json={"operator_notes": "debug", "execution_completed": True},
        created_at=created_at,
        updated_at=updated_at,
    )

    snapshot = AgentTestRunSnapshot(
        id="snapshot-1",
        test_run_id="run-1",
        snapshot_type="fixture",
        source_ref="docs/agent_test_fixtures/regression/saas_b2b_finops_assistant.md",
        checksum="sha256:fixture",
        content_text="## Business Idea\nAI FinOps copilot",
        content_json={"fixture_key": "saas_b2b_finops_assistant"},
        created_at=created_at,
        updated_at=created_at,
    )
    turn = AgentTestTurn(
        id="turn-1",
        test_run_id="run-1",
        turn_index=1,
        actor_type="driver",
        message_role="user",
        message_text="I want to build an AI FinOps copilot.",
        structured_payload={},
        token_usage_json={},
        metadata_json={"kind": "initial_business_idea"},
        created_at=created_at,
        updated_at=created_at,
    )
    annotation = AgentTestAnnotation(
        id="annotation-1",
        test_run_id="run-1",
        turn_index=1,
        actor_type="driver",
        tag="strong_question_signal",
        severity="medium",
        confidence=0.8,
        evidence_text="Asked about the customer pain.",
        evidence_span={"start": 0, "end": 12},
        linked_scoring_dimensions=["problem_clarity"],
        source_type="deterministic",
        metadata_json={},
        created_at=created_at,
        updated_at=created_at,
    )
    score = AgentTestScore(
        id="score-1",
        test_run_id="run-1",
        layer_key="universal",
        dimension_key="problem_clarity",
        raw_score=2,
        normalized_score=0.67,
        weight_percent=15.0,
        blocking=False,
        blocking_threshold=None,
        confidence=0.7,
        evidence_turn_refs=[1],
        metadata_json={},
        created_at=created_at,
        updated_at=created_at,
    )

    detail = _build_run_detail_response(
        run=run,
        snapshots=[snapshot],
        turns=[turn],
        annotations=[annotation],
        scores=[score],
    )

    assert detail.snapshots[0].content_text == "## Business Idea\nAI FinOps copilot"
    assert detail.turns[0].message_text == "I want to build an AI FinOps copilot."
    assert detail.annotations[0].tag == "strong_question_signal"
    assert detail.scores[0].dimension_key == "problem_clarity"
    assert detail.operator_notes == "debug"
