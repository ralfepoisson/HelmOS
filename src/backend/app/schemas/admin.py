"""Admin and registry-facing API contracts."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.agent import AgentDescriptor


class AgentRegistrySnapshotResponse(BaseModel):
    """Runtime snapshot of the specialist agent registry."""

    status: str
    service: str
    timestamp: datetime
    agents: list[AgentDescriptor] = Field(default_factory=list)
