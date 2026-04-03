"""Live execution loop for agent test runs."""

from __future__ import annotations

from dataclasses import dataclass
import asyncio
import structlog

from app.models.agent_test import AgentTestRun
from app.schemas.agent import AgentExecutionInput, AgentExecutionOutput
from app.schemas.agent_test import AgentTestAnnotationInput, AgentTestTurnInput, EvaluateTranscriptRequest
from app.services.agent_test_driver import ScenarioState
from app.services.agent_test_fixtures import AgentTestFixture
from app.services.agent_test_reporting import AgentTestReportRenderer
from app.services.agent_test_rubrics import RubricDefinition
from app.services.agent_test_scoring import AgentTestScoringService, ComputedDimensionScore, ComputedEvaluation
from app.services.runtime_log import persist_runtime_log


logger = structlog.get_logger(__name__)


class AgentTestExecutionStopped(Exception):
    """Raised when an operator requests that a running test stop."""


@dataclass(slots=True)
class AgentTestExecutionResult:
    run: AgentTestRun
    transcript: list[AgentTestTurnInput]
    turns: list[AgentTestTurnInput]
    annotations: list[AgentTestAnnotationInput]
    scores: list[ComputedDimensionScore]
    evaluation: ComputedEvaluation
    report_markdown: str
    metadata_json: dict


class AgentTestExecutionService:
    """Execute a configured agent test run through the production specialist runtime path."""

    def __init__(
        self,
        *,
        scoring_service: AgentTestScoringService | None = None,
        report_renderer: AgentTestReportRenderer | None = None,
    ):
        self.scoring_service = scoring_service or AgentTestScoringService()
        self.report_renderer = report_renderer or AgentTestReportRenderer()

    async def execute(
        self,
        *,
        run: AgentTestRun,
        fixture: AgentTestFixture,
        rubric: RubricDefinition,
        runtime_agent,
        identity_markdown_path: str | None,
        stop_event: asyncio.Event | None = None,
    ) -> AgentTestExecutionResult:
        await persist_runtime_log(
            level="info",
            scope="agent-test-execution",
            event="agent_test_execution_started",
            message=f"Started agent test execution for run {run.id}",
            context={
                "run_id": run.id,
                "target_agent_key": run.target_agent_key,
                "fixture_key": fixture.fixture_key,
                "fixture_version": fixture.fixture_version,
                "min_turns": fixture.min_turns,
                "max_turns": fixture.max_turns,
            },
            full_context=True,
        )
        transcript: list[AgentTestTurnInput] = []
        state = ScenarioState(
            known_to_user=self._known_user_facts(fixture),
            revealable_facts=fixture.revealable_facts,
            blocked_facts=fixture.blocked_facts,
        )

        latest_user_message = self._initial_user_message(fixture)
        transcript.append(
            AgentTestTurnInput(
                turn_index=1,
                actor_type="driver",
                message_role="user",
                message_text=latest_user_message,
                metadata_json={"kind": "initial_business_idea"},
            )
        )

        stop_reason = "max_turns_reached"
        while len(transcript) < fixture.max_turns:
            self._raise_if_stopped(run.id, stop_event)
            logger.info("agent_test_execution.turn_started", run_id=run.id, transcript_length=len(transcript))
            agent_reply, output = await self._run_target_agent(
                run=run,
                runtime_agent=runtime_agent,
                transcript=transcript,
                latest_user_message=latest_user_message,
                stop_event=stop_event,
            )
            self._raise_if_stopped(run.id, stop_event)
            transcript.append(
                AgentTestTurnInput(
                    turn_index=len(transcript) + 1,
                    actor_type="target_agent",
                    message_role="assistant",
                    message_text=agent_reply,
                    structured_payload=output.structured_output or {},
                    metadata_json={
                        "artifact": output.artifact.model_dump(mode="json"),
                        "intermediate_notes": list(output.intermediate_notes),
                        "next_actions": list(output.next_actions),
                    },
                )
            )

            if len(transcript) >= fixture.min_turns and self._agent_message_can_end(agent_reply):
                stop_reason = "minimum_turns_satisfied_with_next_step"
                break

            if len(transcript) >= fixture.max_turns:
                stop_reason = "max_turns_reached_after_agent_reply"
                break

            latest_user_message = self._generate_driver_reply(
                fixture=fixture,
                state=state,
                transcript=transcript,
                agent_message=agent_reply,
            )
            self._raise_if_stopped(run.id, stop_event)
            transcript.append(
                AgentTestTurnInput(
                    turn_index=len(transcript) + 1,
                    actor_type="driver",
                    message_role="user",
                    message_text=latest_user_message,
                    metadata_json={"kind": "simulated_user_reply"},
                )
            )

        annotations = self.scoring_service.generate_annotations(transcript)
        evaluation = self.scoring_service.evaluate(
            agent_key=run.target_agent_key,
            rubric=rubric,
            transcript=transcript,
            annotations=annotations,
            min_turns=fixture.min_turns,
        )
        metadata_json = {
            **(run.metadata_json or {}),
            "execution_requested": True,
            "execution_completed": True,
            "execution_stop_reason": stop_reason,
            "revealed_fact_ids": sorted(state.revealed_fact_ids),
        }
        request = EvaluateTranscriptRequest(
            test_mode=run.test_mode,
            suite_key=run.suite_key,
            target_agent_key=run.target_agent_key,
            target_agent_version=run.target_agent_version,
            target_model_name=run.target_model_name,
            testing_agent_model_name=run.testing_agent_model_name,
            fixture_key=fixture.fixture_key,
            fixture_version=fixture.fixture_version,
            rubric_version=rubric.version,
            driver_version=run.driver_version,
            identity_markdown_path=identity_markdown_path,
            composed_system_prompt=getattr(runtime_agent, "system_prompt", None),
            transcript=transcript,
            annotations=[],
            metadata_json=metadata_json,
        )
        report_markdown = self.report_renderer.render_markdown(
            request=request,
            fixture=fixture,
            evaluation=evaluation,
        )

        run.status = "completed"
        run.actual_turns = len(transcript)
        run.overall_score = evaluation.overall_score
        run.aggregate_confidence = evaluation.aggregate_confidence
        run.verdict = evaluation.verdict
        run.review_required = evaluation.review_required
        run.summary = evaluation.summary
        run.report_markdown = report_markdown
        run.report_json = {
            "hard_failures": evaluation.hard_failures,
            "quality_failures": evaluation.quality_failures,
            "missed_opportunities": evaluation.missed_opportunities,
            "summary": evaluation.summary,
            "stop_reason": stop_reason,
        }
        run.metadata_json = metadata_json
        await persist_runtime_log(
            level="info",
            scope="agent-test-execution",
            event="agent_test_execution_completed",
            message=f"Completed agent test execution for run {run.id}",
            context={
                "run_id": run.id,
                "actual_turns": run.actual_turns,
                "verdict": run.verdict,
                "overall_score": run.overall_score,
                "aggregate_confidence": run.aggregate_confidence,
                "stop_reason": stop_reason,
                "revealed_fact_ids": sorted(state.revealed_fact_ids),
            },
            full_context=True,
        )

        return AgentTestExecutionResult(
            run=run,
            transcript=transcript,
            turns=transcript,
            annotations=annotations,
            scores=evaluation.scores,
            evaluation=evaluation,
            report_markdown=report_markdown,
            metadata_json=metadata_json,
        )

    async def _run_target_agent(
        self,
        *,
        run: AgentTestRun,
        runtime_agent,
        transcript: list[AgentTestTurnInput],
        latest_user_message: str,
        stop_event: asyncio.Event | None,
    ) -> tuple[str, AgentExecutionOutput]:
        self._raise_if_stopped(run.id, stop_event)
        await persist_runtime_log(
            level="info",
            scope="agent-test-execution",
            event="agent_test_turn_agent_call_started",
            message=f"Starting target agent call for run {run.id}",
            context={
                "run_id": run.id,
                "transcript_length": len(transcript),
                "latest_user_message": latest_user_message,
                "model": run.target_model_name,
            },
            full_context=True,
        )
        output = await runtime_agent.execute(
            AgentExecutionInput(
                session_id=f"agent-test-{run.id}",
                run_id=run.id,
                prompt=latest_user_message,
                context={
                    "chat_history": [
                        {"role": turn.message_role, "content": turn.message_text, "actor_type": turn.actor_type}
                        for turn in transcript
                    ],
                    "latest_user_message": latest_user_message,
                    "agent_test_fixture_key": run.fixture_key,
                },
                constraints={"model": run.target_model_name},
                requested_artifact_kind=run.target_agent_key,
            )
        )
        self._raise_if_stopped(run.id, stop_event)
        reply = self._extract_agent_reply(output)
        await persist_runtime_log(
            level="info",
            scope="agent-test-execution",
            event="agent_test_turn_agent_call_completed",
            message=f"Completed target agent call for run {run.id}",
            context={
                "run_id": run.id,
                "transcript_length": len(transcript),
                "reply": reply,
                "artifact": output.artifact.model_dump(mode="json"),
                "structured_output": output.structured_output,
            },
            full_context=True,
        )
        return reply, output

    def _raise_if_stopped(self, run_id: str, stop_event: asyncio.Event | None) -> None:
        if stop_event is not None and stop_event.is_set():
            raise AgentTestExecutionStopped(f"Execution stopped by operator for run {run_id}.")

    def _extract_agent_reply(self, output: AgentExecutionOutput) -> str:
        structured = output.structured_output or {}
        reply = structured.get("reply_to_user") if isinstance(structured, dict) else None
        if isinstance(reply, dict) and isinstance(reply.get("content"), str) and reply["content"].strip():
            return reply["content"].strip()

        for section in output.artifact.sections:
            content = section.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()

        return output.artifact.summary or "Can you tell me a bit more?"

    def _known_user_facts(self, fixture: AgentTestFixture) -> list[str]:
        section_text = fixture.sections.get("What The Simulated User Knows", "")
        facts = [line.strip()[2:].strip() for line in section_text.splitlines() if line.strip().startswith("- ")]
        if fixture.sections.get("Business Idea"):
            facts.insert(0, fixture.sections["Business Idea"].strip())
        return facts

    def _initial_user_message(self, fixture: AgentTestFixture) -> str:
        business_idea = fixture.sections.get("Business Idea", "").strip()
        if business_idea:
            return business_idea
        return fixture.primary_goal or "I would like help refining this business idea."

    def _generate_driver_reply(
        self,
        *,
        fixture: AgentTestFixture,
        state: ScenarioState,
        transcript: list[AgentTestTurnInput],
        agent_message: str,
    ) -> str:
        turn_index = len(transcript) + 1
        satisfied_conditions = self._detect_reveal_conditions(agent_message)
        eligible = state.eligible_facts(turn_index=turn_index, satisfied_conditions=satisfied_conditions)
        if eligible:
            fact = eligible[0]
            state.reveal_fact(fact.fact_id)
            return fact.content

        lowered = agent_message.lower()
        if "who" in lowered or "customer" in lowered or "segment" in lowered:
            return "The strongest fit seems to be engineering-led SaaS teams with growing cloud spend, but I have not narrowed it much further yet."
        if "problem" in lowered or "pain" in lowered:
            return "The recurring theme is that cloud costs keep rising and teams feel they lack enough control."
        if "pricing" in lowered or "charge" in lowered:
            return "My instinct was a relatively low monthly SaaS subscription, although I have not pressure-tested that yet."
        if "differentiat" in lowered or "alternatives" in lowered or "why now" in lowered:
            return "I believe AI-guided recommendations could feel easier to use, but I do not yet have strong proof that this is enough."
        if "onboarding" in lowered or "delivery" in lowered or "implement" in lowered:
            return "I suspect customers may need help getting started, but I have not fully mapped that delivery model yet."
        if "evidence" in lowered or "validate" in lowered or "interview" in lowered:
            return "The signal is early and mostly qualitative, so I know I still need better validation."
        if "next step" in lowered:
            return "I probably need to validate the real pain and buying urgency before I go deeper on features."
        return "That is directionally what I am thinking, but it is still early and a bit broad."

    def _detect_reveal_conditions(self, agent_message: str) -> set[str]:
        lowered = agent_message.lower()
        conditions: set[str] = set()
        if ("spoke" in lowered or "spoken" in lowered or "interview" in lowered or "customer conversation" in lowered):
            conditions.add("asks_about_customer_conversations")
            conditions.add("asks_about_evidence_for_demand")
        if "onboarding" in lowered:
            conditions.add("asks_about_onboarding")
        if "delivery" in lowered or "service" in lowered or "implementation" in lowered:
            conditions.add("asks_about_delivery_model")
        if "differenti" in lowered:
            conditions.add("asks_about_differentiation")
        if "alternative" in lowered or "existing tool" in lowered or "existing tools" in lowered or "competitor" in lowered:
            conditions.add("compares_against_alternatives")
        if "who feels" in lowered or "which customer" in lowered or "customer most" in lowered:
            conditions.add("asks_who_feels_pain_most")
        if "too broad" in lowered or "all startups" in lowered or "broad" in lowered or "narrow" in lowered:
            conditions.add("challenges_target_breadth")
        return conditions

    def _agent_message_can_end(self, agent_message: str) -> bool:
        lowered = agent_message.lower()
        return ("next step" in lowered or "to recap" in lowered or "summary" in lowered) and ("?" not in agent_message)
