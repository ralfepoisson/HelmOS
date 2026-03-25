"""Explicit memory separation helpers."""

from pydantic import BaseModel, Field

from app.models.context import DomainContext
from app.models.run import AgentRun
from app.models.session import Session


class MemoryBundle(BaseModel):
    """Aggregated memory surfaces exposed to orchestration."""

    working_memory: dict = Field(default_factory=dict)
    session_context: dict = Field(default_factory=dict)
    domain_memory: list[dict] = Field(default_factory=list)
    retrieval_context: list[dict] = Field(default_factory=list)


class MemoryManager:
    """Build explicit memory views from persisted state."""

    def build_bundle(
        self,
        *,
        run: AgentRun,
        session: Session,
        domain_contexts: list[DomainContext],
        retrieval_documents: list[dict] | None = None,
    ) -> MemoryBundle:
        return MemoryBundle(
            working_memory=run.state_snapshot or {},
            session_context={
                "session_id": session.id,
                "title": session.title,
                "objective": session.objective,
                "metadata": session.metadata_json,
            },
            domain_memory=[
                {
                    "id": context.id,
                    "type": context.context_type,
                    "name": context.name,
                    "summary": context.summary,
                    "data": context.structured_data,
                }
                for context in domain_contexts
            ],
            retrieval_context=retrieval_documents or [],
        )
