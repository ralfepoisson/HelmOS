from app.schemas.agent_test import AgentTestAnnotationInput, AgentTestTurnInput
from app.services.agent_test_rubrics import RubricRegistry
from app.services.agent_test_scoring import AgentTestScoringService


def _transcript():
    return [
        AgentTestTurnInput(
            turn_index=1,
            actor_type="target_agent",
            message_role="assistant",
            message_text="Who specifically is feeling this cloud cost pain today, and what problem hurts most?",
            metadata_json={
                "progression": {
                    "redundant_question": False,
                    "generic_question": False,
                    "stagnation_event": False,
                    "information_gain_score": 2,
                    "contradiction_surfaced": False,
                    "synthesis_checkpoint_required": False,
                    "synthesis_checkpoint_satisfied": False,
                    "contradiction_checkpoint_satisfied": False,
                    "low_exploration_depth_failure": False,
                }
            },
        ),
        AgentTestTurnInput(
            turn_index=2,
            actor_type="driver",
            message_role="user",
            message_text="Mostly engineering-led startups that are growing quickly.",
        ),
        AgentTestTurnInput(
            turn_index=3,
            actor_type="target_agent",
            message_role="assistant",
            message_text="To recap, there may be a contradiction between low monthly pricing and hands-on onboarding. What evidence do you have so far?",
            metadata_json={
                "progression": {
                    "redundant_question": False,
                    "generic_question": False,
                    "stagnation_event": False,
                    "information_gain_score": 3,
                    "contradiction_surfaced": True,
                    "synthesis_checkpoint_required": False,
                    "synthesis_checkpoint_satisfied": True,
                    "contradiction_checkpoint_satisfied": True,
                    "low_exploration_depth_failure": False,
                }
            },
        ),
        AgentTestTurnInput(
            turn_index=4,
            actor_type="target_agent",
            message_role="assistant",
            message_text="The next step is to validate whether visibility or remediation is the sharper problem through more customer interviews.",
            metadata_json={
                "progression": {
                    "redundant_question": True,
                    "generic_question": False,
                    "stagnation_event": True,
                    "information_gain_score": -1,
                    "contradiction_surfaced": False,
                    "synthesis_checkpoint_required": False,
                    "synthesis_checkpoint_satisfied": False,
                    "contradiction_checkpoint_satisfied": False,
                    "low_exploration_depth_failure": False,
                }
            },
        ),
    ]


def test_scoring_service_generates_annotations_from_transcript():
    annotations = AgentTestScoringService().generate_annotations(_transcript())

    tags = [annotation.tag for annotation in annotations]

    assert "strong_question" in tags
    assert "good_synthesis" in tags
    assert "contradiction_surfaced" in tags


def test_scoring_service_computes_conditional_pass_when_blocking_dimension_breaches():
    transcript = _transcript()
    manual_annotations = [
        AgentTestAnnotationInput(
            turn_index=3,
            actor_type="target_agent",
            tag="missed_opportunity",
            confidence=0.8,
            linked_scoring_dimensions=["critical_constraints_identified", "prioritized_next_action"],
        ),
        AgentTestAnnotationInput(
            turn_index=4,
            actor_type="target_agent",
            tag="context_loss",
            confidence=0.7,
            linked_scoring_dimensions=["reasoning_continuity", "context_retention"],
        ),
    ]
    annotations = AgentTestScoringService().generate_annotations(transcript, manual_annotations)
    rubric = RubricRegistry().get(
        "ideation",
        [
            "hidden_weaknesses_detected",
            "contradictions_surfaced",
            "critical_constraints_identified",
            "key_questions_asked",
            "prioritized_next_action",
        ],
    )

    evaluation = AgentTestScoringService().evaluate(
        agent_key="ideation",
        rubric=rubric,
        transcript=transcript,
        annotations=annotations,
        min_turns=20,
    )

    assert evaluation.verdict in {"CONDITIONAL_PASS", "FAIL", "REVIEW_REQUIRED"}
    assert any(score.dimension_key == "critical_constraints_identified" for score in evaluation.scores)
    assert evaluation.aggregate_confidence > 0
    assert evaluation.summary.startswith("ideation scored")
    assert "redundancy_rate" in evaluation.progression_metrics
    assert evaluation.progression_metrics["avg_information_gain_per_turn"] != 0
