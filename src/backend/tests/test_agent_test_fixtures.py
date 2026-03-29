from app.services.agent_test_fixtures import AgentTestFixtureRepository


def test_fixture_repository_loads_regression_fixture_from_docs():
    repository = AgentTestFixtureRepository()

    fixture = repository.load_fixture("saas_b2b_finops_assistant", "1.0.0")

    assert fixture.fixture_class == "regression"
    assert fixture.min_turns == 20
    assert "ideation" in fixture.applicable_agents
    assert fixture.revealable_facts[0].fact_id == "interviews_count"
    assert "asks_about_customer_conversations" in fixture.revealable_facts[0].reveal_conditions
    assert "exact competitor names" in fixture.blocked_facts
