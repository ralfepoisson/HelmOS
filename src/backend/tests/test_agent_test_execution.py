from types import SimpleNamespace

import pytest

from app.models.agent_test import AgentTestRun
from app.schemas.agent import AgentExecutionOutput, ArtifactPayload
from app.services.agent_test_execution import AgentTestExecutionService
from app.services.agent_test_fixtures import AgentTestFixture, FixtureRevealableFact
from app.services.agent_test_rubrics import RubricRegistry


class FakeAgent:
    def __init__(self, replies: list[str], system_prompt: str = "system prompt"):
        self.replies = replies
        self.system_prompt = system_prompt
        self.calls = []

    async def execute(self, execution_input):
        self.calls.append(execution_input)
        index = min(len(self.calls) - 1, len(self.replies) - 1)
        reply = self.replies[index]
        return AgentExecutionOutput(
            agent_key="ideation",
            version="1.0.0",
            artifact=ArtifactPayload(
                title="Ideation Agent",
                kind="ideation",
                summary="summary",
                sections=[{"heading": "Reply", "content": reply}],
                metadata={},
            ),
            structured_output={
                "reply_to_user": {
                    "content": reply,
                }
            },
        )


def _fixture() -> AgentTestFixture:
    raw_markdown = """---
fixture_key: saas_b2b_finops_assistant
fixture_version: 1.0.0
fixture_class: regression
applicable_agents:
  - ideation
rubric_version_hint: ideation-core-v1
driver_version_hint: scenario-driver-v1
min_turns: 6
max_turns: 8
title: FinOps Copilot for small multi-cloud SaaS teams
primary_goal: Evaluate problem framing and contradiction handling.
scenario_dimensions:
  - hidden_weaknesses_detected
  - contradictions_surfaced
  - critical_constraints_identified
---

## Business Idea

I want to build an AI FinOps copilot for growing SaaS startups that use AWS and GCP.

## What The Simulated User Knows

- Early prospects complain cloud costs are rising.
- Founder imagines charging a low monthly subscription.

## Revealable Facts

### fact_id: interviews_count
- content: "I have only spoken with three startup teams so far."
- reveal_conditions:
  - asks_about_customer_conversations
- must_not_be_disclosed_before_turn: 2

### fact_id: service_heavy_onboarding
- content: "I think we may need to do hands-on cost reviews and setup for customers at the start."
- reveal_conditions:
  - asks_about_onboarding
  - asks_about_delivery_model
- must_not_be_disclosed_before_turn: 3

## Blocked Facts

- exact competitor names
"""
    return AgentTestFixture(
        fixture_key="saas_b2b_finops_assistant",
        fixture_version="1.0.0",
        fixture_class="regression",
        title="FinOps Copilot for small multi-cloud SaaS teams",
        applicable_agents=["ideation"],
        rubric_version_hint="ideation-core-v1",
        driver_version_hint="scenario-driver-v1",
        min_turns=6,
        max_turns=8,
        scenario_dimensions=[
            "hidden_weaknesses_detected",
            "contradictions_surfaced",
            "critical_constraints_identified",
        ],
        primary_goal="Evaluate problem framing and contradiction handling.",
        raw_markdown=raw_markdown,
        path="docs/agent_test_fixtures/regression/saas_b2b_finops_assistant.md",
        sections={
            "Business Idea": "I want to build an AI FinOps copilot for growing SaaS startups that use AWS and GCP.",
            "What The Simulated User Knows": "- Early prospects complain cloud costs are rising.\n- Founder imagines charging a low monthly subscription.",
            "Revealable Facts": "",
            "Blocked Facts": "- exact competitor names",
        },
        revealable_facts=[
            FixtureRevealableFact(
                fact_id="interviews_count",
                content="I have only spoken with three startup teams so far.",
                reveal_conditions=["asks_about_customer_conversations"],
                must_not_be_disclosed_before_turn=2,
            ),
            FixtureRevealableFact(
                fact_id="service_heavy_onboarding",
                content="I think we may need to do hands-on cost reviews and setup for customers at the start.",
                reveal_conditions=["asks_about_onboarding", "asks_about_delivery_model"],
                must_not_be_disclosed_before_turn=3,
            ),
        ],
        blocked_facts=["exact competitor names"],
    )


def _draft_run() -> AgentTestRun:
    return AgentTestRun(
        id="run-1",
        test_mode="single_agent_benchmark",
        target_agent_key="ideation",
        target_agent_version="1.0.0",
        target_model_name="helmos-default",
        fixture_key="saas_b2b_finops_assistant",
        fixture_version="1.0.0",
        rubric_version="ideation-core-v1",
        driver_version="scenario-driver-v1",
        status="draft",
        actual_turns=0,
        min_turns=6,
        overall_score=0.0,
        aggregate_confidence=0.0,
        verdict="PENDING",
        review_required=False,
        summary=None,
        metadata_json={"operator_notes": ""},
        report_json={},
    )


@pytest.mark.asyncio
async def test_execution_service_runs_transcript_and_updates_run():
    service = AgentTestExecutionService()
    agent = FakeAgent(
        [
            "Who specifically is feeling this pain, and how many teams have you spoken with so far?",
            "That helps. How would onboarding and delivery actually work for these customers?",
            "To recap, there may be a contradiction between low-price SaaS and hands-on onboarding. The next step is to validate which problem hurts most.",
        ]
    )
    run = _draft_run()
    fixture = _fixture()
    rubric = RubricRegistry().get(run.target_agent_key, fixture.scenario_dimensions, run.rubric_version)

    result = await service.execute(
        run=run,
        fixture=fixture,
        rubric=rubric,
        runtime_agent=agent,
        identity_markdown_path=None,
    )

    assert result.run.status in {"completed", "failed"}
    assert result.run.actual_turns >= fixture.min_turns
    assert result.run.verdict in {"PASS", "CONDITIONAL_PASS", "FAIL", "REVIEW_REQUIRED"}
    assert result.run.report_markdown
    assert len(result.turns) == result.run.actual_turns
    assert any(turn.actor_type == "target_agent" for turn in result.turns)
    assert any(turn.actor_type == "driver" for turn in result.turns)
    assert result.scores


@pytest.mark.asyncio
async def test_execution_service_only_reveals_fact_when_condition_is_met():
    service = AgentTestExecutionService()
    run = _draft_run()
    fixture = _fixture()
    rubric = RubricRegistry().get(run.target_agent_key, fixture.scenario_dimensions, run.rubric_version)
    agent = FakeAgent(
        [
            "Tell me more about the product vision.",
            "How many teams have you spoken with so far?",
            "How would onboarding work?",
        ]
    )

    result = await service.execute(
        run=run,
        fixture=fixture,
        rubric=rubric,
        runtime_agent=agent,
        identity_markdown_path=None,
    )

    driver_messages = [turn.message_text for turn in result.turns if turn.actor_type == "driver"]

    assert any("three startup teams" in message for message in driver_messages)
    assert any("hands-on cost reviews" in message for message in driver_messages)
    assert "I have only spoken with three startup teams so far." not in driver_messages[0]
