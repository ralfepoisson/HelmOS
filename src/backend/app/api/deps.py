"""Dependency builders for API handlers and workers."""

from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import SpecialistAgentRegistry
from app.config.settings import Settings
from app.memory.manager import MemoryManager
from app.ops.agentops import AgentOpsRegistry
from app.ops.audit import AuditService
from app.ops.langsmith import LangSmithTracer
from app.ops.telemetry import Telemetry
from app.orchestration.runtime import OrchestrationRuntime
from app.repositories.approval_repository import ApprovalRepository
from app.repositories.registry_repository import RegistryRepository
from app.repositories.run_repository import RunRepository
from app.repositories.session_repository import SessionRepository
from app.services.document_export import DocumentExportService
from app.services.llm_gateway import LLMGateway
from app.services.model_router import ModelRouter
from app.services.normalizer import StructuredOutputNormalizer
from app.services.policy import PolicyGuardrailService
from app.services.rules_engine import RulesScoringService
from app.services.template_renderer import TemplateRenderer
from app.tools.adapters import (
    CommunicationsAdapter,
    RetrievalAdapter,
    StorageAdapter,
    WebSearchAdapter,
)
from app.tools.registry import ToolRegistry


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Yield a request-scoped async database session."""

    async with request.app.state.database.session_factory() as session:
        yield session


def get_settings(request: Request) -> Settings:
    """Return app settings."""

    return request.app.state.settings


def build_tool_registry() -> ToolRegistry:
    """Build the controlled tool registry."""

    return ToolRegistry(
        adapters=[
            WebSearchAdapter(),
            RetrievalAdapter(),
            StorageAdapter(),
            CommunicationsAdapter(),
        ]
    )


def build_llm_gateway(settings: Settings) -> LLMGateway:
    """Build the shared LLM gateway client."""

    return LLMGateway(
        provider=settings.llm_gateway_provider,
        base_url=settings.litellm_proxy_url,
        api_key=settings.litellm_api_key,
        timeout_seconds=settings.litellm_timeout_seconds,
    )


def build_specialist_registry(
    settings: Settings,
    *,
    registry_repository: RegistryRepository,
) -> SpecialistAgentRegistry:
    """Build the runtime specialist registry for both admin and workflow paths."""

    return SpecialistAgentRegistry(
        registry_repository=registry_repository,
        tool_registry=build_tool_registry(),
        template_renderer=TemplateRenderer(),
        llm_gateway=build_llm_gateway(settings),
    )


def build_runtime(*, session: AsyncSession, settings: Settings) -> OrchestrationRuntime:
    """Compose the orchestration runtime for request or worker usage."""

    run_repository = RunRepository(session)
    session_repository = SessionRepository(session)
    approval_repository = ApprovalRepository(session)
    registry_repository = RegistryRepository(session)
    specialist_agents = build_specialist_registry(
        settings,
        registry_repository=registry_repository,
    )
    return OrchestrationRuntime(
        settings=settings,
        run_repository=run_repository,
        session_repository=session_repository,
        approval_repository=approval_repository,
        specialist_agents=specialist_agents,
        normalizer=StructuredOutputNormalizer(),
        rules=RulesScoringService(),
        guardrails=PolicyGuardrailService(),
        model_router=ModelRouter(
            default_model=settings.default_model,
            supervisor_model=settings.supervisor_model,
        ),
        document_export=DocumentExportService(),
        memory_manager=MemoryManager(),
        audit_service=AuditService(run_repository),
        telemetry=Telemetry(),
        tracer=LangSmithTracer(
            enabled=settings.langsmith_enabled,
            project_name=settings.langsmith_project,
        ),
        agentops_registry=AgentOpsRegistry(),
    )
