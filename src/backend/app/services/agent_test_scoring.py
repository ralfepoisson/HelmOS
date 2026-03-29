"""Deterministic scoring and annotation for agent testing."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass

from app.schemas.agent_test import AgentTestAnnotationInput, AgentTestTurnInput
from app.services.agent_test_rubrics import RubricDefinition, RubricDimension


@dataclass(slots=True)
class ComputedDimensionScore:
    layer_key: str
    dimension_key: str
    raw_score: int
    normalized_score: float
    weight_percent: float
    blocking: bool
    blocking_threshold: int | None
    confidence: float
    evidence_turn_refs: list[int]


@dataclass(slots=True)
class ComputedEvaluation:
    scores: list[ComputedDimensionScore]
    overall_score: float
    aggregate_confidence: float
    verdict: str
    review_required: bool
    hard_failures: list[dict]
    quality_failures: list[dict]
    missed_opportunities: list[dict]
    generated_annotations: list[AgentTestAnnotationInput]
    summary: str


QUESTION_CUES = (
    "who ",
    "why ",
    "how many",
    "what differentiates",
    "what evidence",
    "what problem",
    "which customer",
    "how would onboarding work",
    "what contradiction",
)

POSITIVE_SUMMARY_CUES = ("summary", "synthesize", "to recap", "next step")
NEGATIVE_ASSUMPTION_CUES = ("assume", "probably", "likely", "must be")
CONTRADICTION_CUES = ("contradiction", "conflict", "tension", "inconsistent")
PREMATURE_SOLUTION_CUES = ("build", "feature", "roadmap", "architecture")


class AgentTestScoringService:
    """Scores transcripts using deterministic heuristics and rubric weights."""

    def generate_annotations(
        self,
        transcript: list[AgentTestTurnInput],
        manual_annotations: list[AgentTestAnnotationInput] | None = None,
    ) -> list[AgentTestAnnotationInput]:
        annotations: list[AgentTestAnnotationInput] = []
        for turn in transcript:
            if turn.actor_type != "target_agent":
                continue
            lowered = turn.message_text.lower()
            if "?" in turn.message_text and any(cue in lowered for cue in QUESTION_CUES):
                annotations.append(
                    AgentTestAnnotationInput(
                        turn_index=turn.turn_index,
                        actor_type=turn.actor_type,
                        tag="strong_question",
                        confidence=0.75,
                        evidence_text=turn.message_text,
                        linked_scoring_dimensions=["targeted_questioning_quality", "key_questions_asked"],
                        source_type="deterministic",
                    )
                )
            if any(cue in lowered for cue in POSITIVE_SUMMARY_CUES):
                annotations.append(
                    AgentTestAnnotationInput(
                        turn_index=turn.turn_index,
                        actor_type=turn.actor_type,
                        tag="good_synthesis",
                        confidence=0.7,
                        evidence_text=turn.message_text,
                        linked_scoring_dimensions=["strategic_synthesis_quality", "clarity_and_structure"],
                        source_type="deterministic",
                    )
                )
            if any(cue in lowered for cue in CONTRADICTION_CUES):
                annotations.append(
                    AgentTestAnnotationInput(
                        turn_index=turn.turn_index,
                        actor_type=turn.actor_type,
                        tag="contradiction_surfaced",
                        confidence=0.8,
                        evidence_text=turn.message_text,
                        linked_scoring_dimensions=["contradiction_surfacing", "contradictions_surfaced"],
                        source_type="deterministic",
                    )
                )
            if any(cue in lowered for cue in NEGATIVE_ASSUMPTION_CUES):
                annotations.append(
                    AgentTestAnnotationInput(
                        turn_index=turn.turn_index,
                        actor_type=turn.actor_type,
                        tag="assumption_without_basis",
                        confidence=0.55,
                        evidence_text=turn.message_text,
                        linked_scoring_dimensions=["hallucination_avoidance"],
                        source_type="deterministic",
                    )
                )
            if any(cue in lowered for cue in PREMATURE_SOLUTION_CUES) and "problem" not in lowered:
                annotations.append(
                    AgentTestAnnotationInput(
                        turn_index=turn.turn_index,
                        actor_type=turn.actor_type,
                        tag="premature_solutioning",
                        confidence=0.6,
                        evidence_text=turn.message_text,
                        linked_scoring_dimensions=["premature_solution_avoidance"],
                        source_type="deterministic",
                    )
                )
        if manual_annotations:
            annotations.extend(manual_annotations)
        return annotations

    def evaluate(
        self,
        *,
        agent_key: str,
        rubric: RubricDefinition,
        transcript: list[AgentTestTurnInput],
        annotations: list[AgentTestAnnotationInput],
        min_turns: int,
    ) -> ComputedEvaluation:
        turns_by_actor = defaultdict(list)
        for turn in transcript:
            turns_by_actor[turn.actor_type].append(turn)

        counts = Counter(annotation.tag for annotation in annotations)
        evidence_turns: dict[str, list[int]] = defaultdict(list)
        for annotation in annotations:
            for dimension in annotation.linked_scoring_dimensions:
                evidence_turns[dimension].append(annotation.turn_index)

        scores: list[ComputedDimensionScore] = []
        scores.extend(self._score_layer("universal", rubric.universal.dimensions, counts, evidence_turns, transcript, agent_key, min_turns))
        scores.extend(self._score_layer("agent_class", rubric.agent_class.dimensions, counts, evidence_turns, transcript, agent_key, min_turns))
        scores.extend(self._score_layer("scenario", rubric.scenario.dimensions, counts, evidence_turns, transcript, agent_key, min_turns))

        overall_score = self._calculate_overall_score(scores, rubric)
        aggregate_confidence = self._calculate_aggregate_confidence(scores)
        hard_failures, quality_failures, missed_opportunities = self._classify_failures(scores, counts)
        verdict, review_required = self._compute_verdict(overall_score, aggregate_confidence, hard_failures, scores)
        summary = self._build_summary(agent_key, overall_score, verdict, counts)

        return ComputedEvaluation(
            scores=scores,
            overall_score=overall_score,
            aggregate_confidence=aggregate_confidence,
            verdict=verdict,
            review_required=review_required,
            hard_failures=hard_failures,
            quality_failures=quality_failures,
            missed_opportunities=missed_opportunities,
            generated_annotations=annotations,
            summary=summary,
        )

    def _score_layer(
        self,
        layer_key: str,
        dimensions: list[RubricDimension],
        counts: Counter,
        evidence_turns: dict[str, list[int]],
        transcript: list[AgentTestTurnInput],
        agent_key: str,
        min_turns: int,
    ) -> list[ComputedDimensionScore]:
        return [
            self._score_dimension(
                layer_key=layer_key,
                dimension=dimension,
                counts=counts,
                evidence_turns=evidence_turns,
                transcript=transcript,
                agent_key=agent_key,
                min_turns=min_turns,
            )
            for dimension in dimensions
        ]

    def _score_dimension(
        self,
        *,
        layer_key: str,
        dimension: RubricDimension,
        counts: Counter,
        evidence_turns: dict[str, list[int]],
        transcript: list[AgentTestTurnInput],
        agent_key: str,
        min_turns: int,
    ) -> ComputedDimensionScore:
        raw_score = 3
        total_turns = len(transcript)

        if dimension.key == "instruction_adherence":
            raw_score = 5 - min(4, counts["instruction_violation"] + counts["format_non_compliance"])
        elif dimension.key == "reasoning_continuity":
            raw_score = 4 + min(1, counts["good_synthesis"]) - min(3, counts["context_loss"] + counts["contradiction_introduced"])
        elif dimension.key == "hallucination_avoidance":
            raw_score = 5 - min(4, counts["assumption_without_basis"] + counts["hallucination_risk"])
        elif dimension.key == "clarity_and_structure":
            raw_score = 3 + min(2, counts["good_synthesis"] + counts["useful_next_step"])
        elif dimension.key == "usefulness_of_outputs":
            raw_score = 3 + min(2, counts["strong_question"] + counts["useful_next_step"]) - min(2, counts["missed_opportunity"])
        elif dimension.key == "context_retention":
            raw_score = 4 - min(3, counts["context_loss"])
        elif dimension.key == "weakest_area_prioritization":
            raw_score = 3 + min(2, counts["strong_question"]) - min(2, counts["missed_opportunity"])
        elif dimension.key == "problem_framing_quality":
            raw_score = self._keyword_score(transcript, ("problem", "pain", "impact"), positive_bonus=1)
        elif dimension.key == "targeted_questioning_quality":
            raw_score = 2 + min(3, counts["strong_question"])
        elif dimension.key == "contradiction_surfacing":
            raw_score = 2 + min(3, counts["contradiction_surfaced"])
        elif dimension.key == "premature_solution_avoidance":
            raw_score = 5 - min(4, counts["premature_solutioning"])
        elif dimension.key == "strategic_synthesis_quality":
            raw_score = 2 + min(3, counts["good_synthesis"])
        elif dimension.key == "customer_profile_specificity":
            raw_score = self._keyword_score(transcript, ("customer", "segment", "role"), positive_bonus=1)
        elif dimension.key == "jobs_pains_gains_rigor":
            raw_score = self._keyword_score(transcript, ("jobs", "pains", "gains"), positive_bonus=1)
        elif dimension.key == "value_map_quality":
            raw_score = self._keyword_score(transcript, ("pain reliever", "gain creator", "products"), positive_bonus=1)
        elif dimension.key == "fit_consistency_analysis":
            raw_score = self._keyword_score(transcript, ("fit", "consistent", "align"), positive_bonus=1)
        elif dimension.key == "challenge_of_weak_assumptions":
            raw_score = 3 + min(2, counts["strong_question"] + counts["contradiction_surfaced"]) - min(2, counts["missed_opportunity"])
        elif dimension.key == "output_canvas_structure":
            raw_score = self._keyword_score(transcript, ("customer profile", "value map"), positive_bonus=1)
        elif dimension.key == "hidden_weaknesses_detected":
            raw_score = 2 + min(3, counts["strong_question"] + counts["contradiction_surfaced"])
        elif dimension.key == "contradictions_surfaced":
            raw_score = 2 + min(3, counts["contradiction_surfaced"])
        elif dimension.key == "critical_constraints_identified":
            raw_score = self._keyword_score(transcript, ("constraint", "pricing", "onboarding", "delivery model"), positive_bonus=0)
        elif dimension.key == "key_questions_asked":
            raw_score = 2 + min(3, counts["strong_question"])
        elif dimension.key == "prioritized_next_action":
            raw_score = self._keyword_score(transcript, ("next step", "validate", "interview"), positive_bonus=1)

        if total_turns < min_turns:
            raw_score = max(1, raw_score - 1)

        raw_score = max(1, min(5, raw_score))
        normalized_score = round((raw_score - 1) / 4, 4)
        confidence = self._score_confidence(evidence_turns.get(dimension.key, []), total_turns)
        return ComputedDimensionScore(
            layer_key=layer_key,
            dimension_key=dimension.key,
            raw_score=raw_score,
            normalized_score=normalized_score,
            weight_percent=dimension.weight_percent,
            blocking=dimension.blocking,
            blocking_threshold=dimension.blocking_threshold,
            confidence=confidence,
            evidence_turn_refs=sorted(set(evidence_turns.get(dimension.key, []))),
        )

    def _keyword_score(self, transcript: list[AgentTestTurnInput], keywords: tuple[str, ...], *, positive_bonus: int) -> int:
        agent_messages = " ".join(turn.message_text.lower() for turn in transcript if turn.actor_type == "target_agent")
        matches = sum(1 for keyword in keywords if keyword in agent_messages)
        return 2 + min(3, matches + positive_bonus)

    def _score_confidence(self, evidence_turn_refs: list[int], total_turns: int) -> float:
        density = min(1.0, (len(set(evidence_turn_refs)) / max(1, total_turns)) * 4)
        length_factor = 1.0 if total_turns >= 20 else 0.6
        return round(max(0.2, min(0.95, (density * 0.7) + (length_factor * 0.3))), 2)

    def _calculate_overall_score(self, scores: list[ComputedDimensionScore], rubric: RubricDefinition) -> float:
        layer_weights = {
            "universal": rubric.universal.weight_percent / 100,
            "agent_class": rubric.agent_class.weight_percent / 100,
            "scenario": rubric.scenario.weight_percent / 100,
        }
        overall = 0.0
        for layer_key, layer_weight in layer_weights.items():
            layer_scores = [score for score in scores if score.layer_key == layer_key]
            layer_total = sum(score.normalized_score * (score.weight_percent / 100) for score in layer_scores)
            overall += layer_total * layer_weight
        return round(overall * 100, 2)

    def _calculate_aggregate_confidence(self, scores: list[ComputedDimensionScore]) -> float:
        total_weight = sum(score.weight_percent for score in scores)
        weighted = sum(score.confidence * score.weight_percent for score in scores)
        return round(weighted / total_weight, 2) if total_weight else 0.0

    def _classify_failures(self, scores: list[ComputedDimensionScore], counts: Counter) -> tuple[list[dict], list[dict], list[dict]]:
        hard_failures: list[dict] = []
        quality_failures: list[dict] = []
        missed_opportunities: list[dict] = []

        for score in scores:
            if score.blocking and score.blocking_threshold is not None and score.raw_score <= max(1, score.blocking_threshold - 2):
                hard_failures.append(
                    {
                        "dimension_key": score.dimension_key,
                        "message": f"Blocking dimension '{score.dimension_key}' fell well below threshold.",
                        "evidence_turn_refs": score.evidence_turn_refs,
                    }
                )
            elif score.raw_score < 3:
                quality_failures.append(
                    {
                        "dimension_key": score.dimension_key,
                        "message": f"Dimension '{score.dimension_key}' is below expected specialist quality.",
                        "evidence_turn_refs": score.evidence_turn_refs,
                    }
                )

        if counts["missed_opportunity"]:
            missed_opportunities.append(
                {
                    "code": "opportunity.unexploited_high_value_opening",
                    "message": "The transcript contains at least one missed high-value opportunity.",
                }
            )
        return hard_failures, quality_failures, missed_opportunities

    def _compute_verdict(
        self,
        overall_score: float,
        aggregate_confidence: float,
        hard_failures: list[dict],
        scores: list[ComputedDimensionScore],
    ) -> tuple[str, bool]:
        has_blocking_breach = any(
            score.blocking and score.blocking_threshold is not None and score.raw_score < score.blocking_threshold
            for score in scores
        )
        review_required = aggregate_confidence < 0.45 or has_blocking_breach
        if hard_failures:
            return "FAIL", review_required
        if aggregate_confidence < 0.45:
            return "REVIEW_REQUIRED", True
        if overall_score >= 75 and not has_blocking_breach:
            return "PASS", review_required
        if overall_score >= 60:
            return "CONDITIONAL_PASS", True if has_blocking_breach else review_required
        return "FAIL", review_required

    def _build_summary(self, agent_key: str, overall_score: float, verdict: str, counts: Counter) -> str:
        return (
            f"{agent_key} scored {overall_score:.2f} with verdict {verdict}. "
            f"Detected {counts['strong_question']} strong-question signals, "
            f"{counts['contradiction_surfaced']} contradiction signals, and "
            f"{counts['missed_opportunity']} missed-opportunity signals."
        )
