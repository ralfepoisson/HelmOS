"""Report rendering for agent test evaluations."""

from __future__ import annotations

from app.schemas.agent_test import EvaluateTranscriptRequest
from app.services.agent_test_fixtures import AgentTestFixture
from app.services.agent_test_scoring import ComputedEvaluation


class AgentTestReportRenderer:
    """Renders deterministic markdown reports."""

    def render_markdown(
        self,
        *,
        request: EvaluateTranscriptRequest,
        fixture: AgentTestFixture,
        evaluation: ComputedEvaluation,
    ) -> str:
        lines = [
            "# Agent Test Report",
            "",
            "## Run Summary",
            "",
            f"- Target agent: `{request.target_agent_key}`",
            f"- Fixture: `{fixture.fixture_key}` `{fixture.fixture_version}`",
            f"- Test mode: `{request.test_mode}`",
            f"- Verdict: `{evaluation.verdict}`",
            f"- Overall score: `{evaluation.overall_score:.2f}`",
            f"- Aggregate confidence: `{evaluation.aggregate_confidence:.2f}`",
            "",
            "## Fixture Goal",
            "",
            fixture.primary_goal,
            "",
            "## Failure Summary",
            "",
            f"- Hard failures: `{len(evaluation.hard_failures)}`",
            f"- Quality failures: `{len(evaluation.quality_failures)}`",
            f"- Missed opportunities: `{len(evaluation.missed_opportunities)}`",
            "",
            "## Dimension Scores",
            "",
        ]
        for score in evaluation.scores:
            lines.append(
                f"- `{score.layer_key}.{score.dimension_key}`: score `{score.raw_score}` "
                f"(confidence `{score.confidence:.2f}`)"
            )
        lines.extend(
            [
                "",
                "## Summary",
                "",
                evaluation.summary,
            ]
        )
        return "\n".join(lines)
