from app.services.rules_engine import RulesScoringService


def test_classify_prefers_requested_agent():
    rules = RulesScoringService()

    decision = rules.classify("Help me with roadmap planning", requested_agent="research")

    assert decision["route"] == "agent"
    assert decision["agent_key"] == "research"


def test_score_risk_requires_approval_for_external_actions():
    rules = RulesScoringService()

    result = rules.score_risk({"externally_visible": True, "tool_calls": ["email"]})

    assert result["requires_approval"] is True
