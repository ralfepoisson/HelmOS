"""Scenario state and reveal-rule handling for agent testing."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.agent_test_fixtures import FixtureRevealableFact


@dataclass(slots=True)
class ScenarioState:
    """Mutable state of a scenario-driven simulated user."""

    known_to_user: list[str]
    revealable_facts: list[FixtureRevealableFact]
    blocked_facts: list[str]
    revealed_fact_ids: set[str] = field(default_factory=set)

    def eligible_facts(self, *, turn_index: int, satisfied_conditions: set[str]) -> list[FixtureRevealableFact]:
        eligible: list[FixtureRevealableFact] = []
        for fact in self.revealable_facts:
            if fact.fact_id in self.revealed_fact_ids:
                continue
            if turn_index < fact.must_not_be_disclosed_before_turn:
                continue
            if fact.reveal_conditions and not satisfied_conditions.intersection(fact.reveal_conditions):
                continue
            eligible.append(fact)
        return eligible

    def reveal_fact(self, fact_id: str) -> None:
        self.revealed_fact_ids.add(fact_id)

    def validate_response_text(self, text: str) -> list[str]:
        violations: list[str] = []
        lowered = text.lower()
        for blocked in self.blocked_facts:
            if blocked.lower() in lowered:
                violations.append(blocked)
        for fact in self.revealable_facts:
            if fact.fact_id in self.revealed_fact_ids:
                continue
            if fact.content and fact.content.lower() in lowered:
                violations.append(fact.fact_id)
        return violations
