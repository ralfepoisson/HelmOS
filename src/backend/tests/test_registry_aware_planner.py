from app.services.rules_engine import RulesScoringService


def test_registry_aware_planner_can_route_to_registered_agent():
    rules = RulesScoringService()

    decision = rules.classify(
        "Please use the ideation agent to shape this founder brief.",
        available_agents=[
            {
                "key": "ideation",
                "name": "Ideation Agent",
                "purpose": "Turn founder input into a structured idea brief.",
            }
        ],
    )

    assert decision["route"] == "agent"
    assert decision["agent_key"] == "ideation"
