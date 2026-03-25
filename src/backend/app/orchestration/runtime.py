"""Workflow runtime orchestration service."""

from uuid import uuid4

import structlog

from app.agents.registry import SpecialistAgentRegistry
from app.memory.manager import MemoryManager
from app.models.approval import ApprovalRequest
from app.models.artifact import Artifact
from app.models.checkpoint import AgentCheckpoint
from app.models.enums import ApprovalStatus, RunStatus
from app.orchestration.graph import WorkflowGraphBuilder
from app.orchestration.state import WorkflowState
from app.ops.agentops import AgentOpsRegistry
from app.ops.audit import AuditService
from app.ops.langsmith import LangSmithTracer
from app.ops.telemetry import Telemetry
from app.repositories.approval_repository import ApprovalRepository
from app.repositories.run_repository import RunRepository
from app.repositories.session_repository import SessionRepository
from app.schemas.agent import AgentExecutionInput, ArtifactPayload
from app.services.document_export import DocumentExportService
from app.services.model_router import ModelRouter
from app.services.normalizer import StructuredOutputNormalizer
from app.services.policy import PolicyGuardrailService
from app.services.rules_engine import RulesScoringService


logger = structlog.get_logger(__name__)


class OrchestrationRuntime:
    """Owns workflow execution, approval checkpoints, and persistence updates."""

    def __init__(
        self,
        *,
        settings,
        run_repository: RunRepository,
        session_repository: SessionRepository,
        approval_repository: ApprovalRepository,
        specialist_agents: SpecialistAgentRegistry,
        normalizer: StructuredOutputNormalizer,
        rules: RulesScoringService,
        guardrails: PolicyGuardrailService,
        model_router: ModelRouter,
        document_export: DocumentExportService,
        memory_manager: MemoryManager,
        audit_service: AuditService,
        telemetry: Telemetry,
        tracer: LangSmithTracer,
        agentops_registry: AgentOpsRegistry,
    ):
        self.settings = settings
        self.run_repository = run_repository
        self.session_repository = session_repository
        self.approval_repository = approval_repository
        self.specialist_agents = specialist_agents
        self.normalizer = normalizer
        self.rules = rules
        self.guardrails = guardrails
        self.model_router = model_router
        self.document_export = document_export
        self.memory_manager = memory_manager
        self.audit_service = audit_service
        self.telemetry = telemetry
        self.tracer = tracer
        self.agentops_registry = agentops_registry
        self.graph = WorkflowGraphBuilder(self).build()

    async def execute(self, initial_state: WorkflowState) -> WorkflowState:
        """Run the workflow to completion or approval pause."""

        async with self.tracer.trace("helmos-run", metadata={"run_id": initial_state["run_id"]}):
            return await self.graph.ainvoke(initial_state)

    async def resume_after_approval(
        self,
        checkpoint_ref: str,
        *,
        context_updates: dict | None = None,
    ) -> WorkflowState:
        """Resume a paused run after a persisted approval decision."""

        checkpoint = await self.run_repository.get_checkpoint_by_ref(checkpoint_ref)
        if checkpoint is None:
            raise LookupError(f"Checkpoint '{checkpoint_ref}' was not found.")

        state: WorkflowState = dict(checkpoint.state_payload)
        if context_updates:
            working_memory = dict(state.get("working_memory") or {})
            working_memory.update(context_updates)
            state["working_memory"] = working_memory
        state["approval_required"] = False
        policy_result = dict(state.get("policy_result") or {})
        policy_result["requires_approval"] = False
        state["policy_result"] = policy_result

        run = await self.run_repository.get_run(state["run_id"])
        await self.run_repository.update_status(run, RunStatus.RUNNING, checkpoint_ref=checkpoint_ref)
        await self.audit_service.log(
            run_id=run.id,
            session_id=run.session_id,
            event_type="run.resumed",
            payload={"checkpoint_ref": checkpoint_ref},
            message="Run resumed after approval.",
        )
        return await self.finalize_node(state)

    async def supervisor_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("supervisor", state["run_id"])
        await self.audit_service.log(
            run_id=state["run_id"],
            session_id=state["session_id"],
            event_type="supervisor.classified",
            payload={"model": self.model_router.for_supervisor()},
            message="Supervisor received run for classification.",
        )
        state.setdefault("history", []).append({"node": "supervisor", "status": "entered"})
        return state

    async def planner_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("planner", state["run_id"])
        available_agents = await self.specialist_agents.list_descriptors()
        decision = self.rules.classify(
            state["input_text"],
            state.get("requested_agent"),
            available_agents=[descriptor.model_dump() for descriptor in available_agents],
        )
        state["route"] = decision["route"]
        state["selected_agent"] = decision.get("agent_key")
        state.setdefault("history", []).append({"node": "planner", "decision": decision})
        await self.audit_service.log(
            run_id=state["run_id"],
            session_id=state["session_id"],
            event_type="planner.routed",
            payload=decision,
            message="Planner selected execution path.",
        )
        return state

    def route_from_planner(self, state: WorkflowState) -> str:
        return state.get("route", "deterministic")

    async def deterministic_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("deterministic", state["run_id"])
        artifact = ArtifactPayload(
            title="Deterministic Summary",
            kind="generic",
            summary="A deterministic route handled this request without specialist delegation.",
            sections=[
                {"heading": "Request", "content": state["input_text"]},
                {
                    "heading": "Handling",
                    "content": "The rules engine selected deterministic handling for a lightweight request.",
                },
            ],
            metadata={"agentops": self.agentops_registry.evaluation_hooks()},
        )
        state["normalized_output"] = {
            "agent_key": "deterministic_service",
            "version": "1.0.0",
            "artifact": artifact.model_dump(),
            "requested_tools": [],
        }
        return state

    async def specialist_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("specialist", state["run_id"])
        agent = await self.specialist_agents.get(state["selected_agent"] or "ideation")
        run = await self.run_repository.get_run(state["run_id"])
        session = await self.session_repository.get_session(state["session_id"])
        domain_contexts = await self.session_repository.list_domain_contexts(state["session_id"])
        memory_bundle = self.memory_manager.build_bundle(
            run=run,
            session=session,
            domain_contexts=domain_contexts,
        )
        agent_input = AgentExecutionInput(
            session_id=state["session_id"],
            run_id=state["run_id"],
            prompt=state["input_text"],
            context={
                "session": memory_bundle.session_context,
                "domain": memory_bundle.domain_memory,
                **(state.get("working_memory") or {}),
            },
            constraints={
                "model": agent.descriptor.default_model
                or self.model_router.for_agent(agent.descriptor.key)
            },
        )
        output = await agent.execute(agent_input)
        normalized = self.normalizer.normalize(output)
        state["normalized_output"] = normalized
        return state

    async def multi_step_workflow_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("workflow", state["run_id"])
        research_agent = await self.specialist_agents.get("research")
        research = await research_agent.execute(
            AgentExecutionInput(
                session_id=state["session_id"],
                run_id=state["run_id"],
                prompt=state["input_text"],
                context=state.get("working_memory") or {},
                constraints={"mode": "workflow"},
                requested_artifact_kind="research_summary",
            )
        )
        roadmap_agent = await self.specialist_agents.get("roadmap")
        roadmap = await roadmap_agent.execute(
            AgentExecutionInput(
                session_id=state["session_id"],
                run_id=state["run_id"],
                prompt=state["input_text"],
                context={"research": research.artifact.model_dump()},
                constraints={"mode": "workflow"},
                requested_artifact_kind="roadmap",
            )
        )
        research_normalized = self.normalizer.normalize(research)
        roadmap_normalized = self.normalizer.normalize(roadmap)
        roadmap_normalized["workflow_steps"] = [
            research_normalized,
            {
                "agent_key": roadmap_normalized["agent_key"],
                "version": roadmap_normalized["version"],
                "artifact": roadmap_normalized["artifact"],
            },
        ]
        roadmap_normalized["requested_tools"] = research.requested_tools + roadmap.requested_tools
        state["normalized_output"] = roadmap_normalized
        return state

    async def policy_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("policy", state["run_id"])
        policy_result = self.guardrails.evaluate(
            route=state.get("route", "deterministic"),
            normalized_output=state.get("normalized_output", {}),
            run_context={"approvals_enabled": self.settings.enable_approvals},
        )
        state["policy_result"] = policy_result
        state["approval_required"] = policy_result["requires_approval"]
        await self.audit_service.log(
            run_id=state["run_id"],
            session_id=state["session_id"],
            event_type="policy.evaluated",
            payload=policy_result,
            message="Policy checks completed.",
        )
        return state

    def route_from_policy(self, state: WorkflowState) -> str:
        return "approval" if state.get("approval_required") else "finalize"

    async def approval_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("approval", state["run_id"])
        checkpoint_ref = f"chk_{uuid4().hex}"
        checkpoint = await self.run_repository.create_checkpoint(
            AgentCheckpoint(
                run_id=state["run_id"],
                node_name="approval",
                checkpoint_ref=checkpoint_ref,
                state_payload=dict(state),
                summary=state["policy_result"].get("reason"),
            )
        )
        approval = await self.run_repository.add_approval(
            ApprovalRequest(
                run_id=state["run_id"],
                checkpoint_id=checkpoint.id,
                action_type="review_output",
                rationale=state["policy_result"].get("reason"),
                requested_payload=str(state.get("normalized_output", {})),
                status=ApprovalStatus.PENDING,
            )
        )
        run = await self.run_repository.get_run(state["run_id"])
        run.current_checkpoint_id = checkpoint.id
        run.state_snapshot = dict(state)
        run.checkpoint_ref = checkpoint_ref
        await self.run_repository.update_status(
            run,
            RunStatus.WAITING_FOR_APPROVAL,
            checkpoint_ref=checkpoint_ref,
        )
        await self.audit_service.log(
            run_id=state["run_id"],
            session_id=state["session_id"],
            event_type="approval.requested",
            payload={"approval_id": approval.id, "checkpoint_ref": checkpoint_ref},
            message="Run paused pending approval.",
        )
        state["approval_id"] = approval.id
        state["checkpoint_ref"] = checkpoint_ref
        return state

    async def finalize_node(self, state: WorkflowState) -> WorkflowState:
        self.telemetry.instrument_workflow_node("finalize", state["run_id"])
        run = await self.run_repository.get_run(state["run_id"])
        run.normalized_output = state.get("normalized_output", {})
        run.state_snapshot = dict(state)
        exported = await self.document_export.export(run.normalized_output, format_name="json")
        artifact_payload = run.normalized_output.get("artifact", {})
        artifact = Artifact(
            run_id=run.id,
            session_id=run.session_id,
            kind=artifact_payload.get("kind", "generic"),
            title=artifact_payload.get("title", "Generated Artifact"),
            summary=artifact_payload.get("summary"),
            content_json=run.normalized_output,
            storage_uri=exported.get("note"),
        )
        await self.run_repository.add_artifact(artifact)
        await self.run_repository.update_status(run, RunStatus.COMPLETED)
        await self.audit_service.log(
            run_id=state["run_id"],
            session_id=state["session_id"],
            event_type="run.completed",
            payload={"artifact_title": artifact.title},
            message="Run completed successfully.",
        )
        return state
