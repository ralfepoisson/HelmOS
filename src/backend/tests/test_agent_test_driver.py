from app.services.agent_test_driver import ScenarioState
from app.services.agent_test_fixtures import FixtureRevealableFact


def test_scenario_state_only_reveals_fact_after_turn_and_condition_match():
    state = ScenarioState(
        known_to_user=["founder interviewed only three teams"],
        revealable_facts=[
            FixtureRevealableFact(
                fact_id="interviews_count",
                content="I have only spoken with three startup teams so far.",
                reveal_conditions=["asks_about_customer_conversations"],
                must_not_be_disclosed_before_turn=2,
            )
        ],
        blocked_facts=["exact competitor names"],
    )

    assert state.eligible_facts(turn_index=1, satisfied_conditions={"asks_about_customer_conversations"}) == []

    eligible = state.eligible_facts(turn_index=2, satisfied_conditions={"asks_about_customer_conversations"})

    assert len(eligible) == 1
    assert eligible[0].fact_id == "interviews_count"


def test_scenario_state_flags_blocked_or_unreleased_content_in_response():
    state = ScenarioState(
        known_to_user=[],
        revealable_facts=[
            FixtureRevealableFact(
                fact_id="service_heavy_onboarding",
                content="I think we may need to do hands-on cost reviews and setup for customers at the start.",
                reveal_conditions=["asks_about_onboarding"],
                must_not_be_disclosed_before_turn=3,
            )
        ],
        blocked_facts=["exact competitor names"],
    )

    violations = state.validate_response_text(
        "We may need to do hands-on cost reviews and setup for customers at the start, and exact competitor names matter."
    )

    assert "service_heavy_onboarding" in violations
    assert "exact competitor names" in violations
