"""Built-in rubric definitions for agent testing."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class RubricDimension:
    key: str
    weight_percent: float
    blocking: bool = False
    blocking_threshold: int | None = None


@dataclass(slots=True)
class RubricLayer:
    key: str
    weight_percent: float
    dimensions: list[RubricDimension] = field(default_factory=list)


@dataclass(slots=True)
class RubricDefinition:
    version: str
    agent_key: str
    universal: RubricLayer
    agent_class: RubricLayer
    scenario: RubricLayer


def _universal_layer() -> RubricLayer:
    return RubricLayer(
        key="universal",
        weight_percent=40.0,
        dimensions=[
            RubricDimension("instruction_adherence", 20.0, True, 3),
            RubricDimension("reasoning_continuity", 20.0, True, 3),
            RubricDimension("hallucination_avoidance", 20.0, True, 3),
            RubricDimension("clarity_and_structure", 15.0, False, None),
            RubricDimension("usefulness_of_outputs", 15.0, True, 3),
            RubricDimension("context_retention", 10.0, False, None),
        ],
    )


def _ideation_layer() -> RubricLayer:
    return RubricLayer(
        key="agent_class",
        weight_percent=35.0,
        dimensions=[
            RubricDimension("weakest_area_prioritization", 20.0, True, 3),
            RubricDimension("problem_framing_quality", 20.0, True, 3),
            RubricDimension("targeted_questioning_quality", 20.0, True, 3),
            RubricDimension("contradiction_surfacing", 15.0, False, None),
            RubricDimension("premature_solution_avoidance", 10.0, False, None),
            RubricDimension("strategic_synthesis_quality", 15.0, False, None),
        ],
    )


def _value_proposition_layer() -> RubricLayer:
    return RubricLayer(
        key="agent_class",
        weight_percent=35.0,
        dimensions=[
            RubricDimension("customer_profile_specificity", 20.0, True, 3),
            RubricDimension("jobs_pains_gains_rigor", 20.0, True, 3),
            RubricDimension("value_map_quality", 20.0, True, 3),
            RubricDimension("fit_consistency_analysis", 20.0, True, 3),
            RubricDimension("challenge_of_weak_assumptions", 10.0, False, None),
            RubricDimension("output_canvas_structure", 10.0, False, None),
        ],
    )


def _scenario_layer(scenario_dimensions: list[str]) -> RubricLayer:
    dimensions: list[RubricDimension] = []
    if not scenario_dimensions:
        scenario_dimensions = ["hidden_weaknesses_detected", "contradictions_surfaced", "key_questions_asked"]
    base_weight = round(100.0 / len(scenario_dimensions), 2)
    accumulated = 0.0
    for index, key in enumerate(scenario_dimensions):
        weight = base_weight
        if index == len(scenario_dimensions) - 1:
            weight = round(100.0 - accumulated, 2)
        accumulated += weight
        dimensions.append(
            RubricDimension(
                key=key,
                weight_percent=weight,
                blocking=key in {
                    "hidden_weaknesses_detected",
                    "contradictions_surfaced",
                    "critical_constraints_identified",
                },
                blocking_threshold=3 if key in {
                    "hidden_weaknesses_detected",
                    "contradictions_surfaced",
                    "critical_constraints_identified",
                } else None,
            )
        )
    return RubricLayer(key="scenario", weight_percent=25.0, dimensions=dimensions)


class RubricRegistry:
    """Provides built-in rubric definitions."""

    def get(self, agent_key: str, scenario_dimensions: list[str], version: str | None = None) -> RubricDefinition:
        resolved_version = version or f"{agent_key}-core-v1"
        agent_layer = _ideation_layer() if agent_key == "ideation" else _value_proposition_layer()
        return RubricDefinition(
            version=resolved_version,
            agent_key=agent_key,
            universal=_universal_layer(),
            agent_class=agent_layer,
            scenario=_scenario_layer(scenario_dimensions),
        )
