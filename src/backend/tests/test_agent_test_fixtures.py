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


def test_fixture_repository_loads_prospecting_strategy_review_fixture_from_docs():
    repository = AgentTestFixtureRepository()

    fixture = repository.load_fixture("prospecting_operator_review", "1.0.0")

    assert fixture.fixture_class == "strategy_review"
    assert fixture.title == "Prospecting strategy review for fragmented service sectors"
    assert fixture.min_turns == 10
    assert "prospecting" in fixture.applicable_agents
    assert fixture.revealable_facts[0].fact_id == "manual_search_only"
    assert "asks_about_source_mix" in fixture.revealable_facts[0].reveal_conditions
    assert "invented conversion benchmarks" in fixture.blocked_facts


def test_fixture_repository_loads_proto_idea_fixture_from_docs():
    repository = AgentTestFixtureRepository()

    fixture = repository.load_fixture("field_service_dispatch_breakdown", "1.0.0")

    assert fixture.fixture_class == "extraction_regression"
    assert fixture.title == "Multi-angle proto-idea extraction from field service dispatch complaints"
    assert fixture.min_turns == 1
    assert "proto_idea" in fixture.applicable_agents
    assert fixture.revealable_facts[0].fact_id == "existing_tool_failed_due_to_setup"
    assert "asks_about_prior_attempts" in fixture.revealable_facts[0].reveal_conditions
    assert "invented market size estimates" in fixture.blocked_facts


def test_fixture_repository_loads_value_proposition_fixture_from_docs():
    repository = AgentTestFixtureRepository()

    fixture = repository.load_fixture("freelancer_cashflow_canvas", "1.0.0")

    assert fixture.fixture_class == "regression"
    assert fixture.title == "Value Proposition Canvas for freelancer cash-flow stabilization"
    assert fixture.min_turns == 10
    assert "value_proposition" in fixture.applicable_agents
    assert fixture.revealable_facts[0].fact_id == "strongest_segment_is_established_freelancers"
    assert "asks_about_customer_segments" in fixture.revealable_facts[0].reveal_conditions
    assert "invented default rates" in fixture.blocked_facts
