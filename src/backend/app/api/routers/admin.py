"""Agent admin routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import build_specialist_registry, get_registry_db_session, get_settings
from app.config.settings import Settings
from app.repositories.registry_repository import RegistryRepository
from app.schemas.admin import AgentRegistrySnapshotResponse
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter()


@router.get("/agents", response_model=AgentRegistrySnapshotResponse)
async def list_runtime_agents(
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_registry_db_session),
) -> AgentRegistrySnapshotResponse:
    """Return the currently registered specialist agents."""

    registry = build_specialist_registry(
        settings,
        registry_repository=RegistryRepository(db),
    )
    return AgentRegistrySnapshotResponse(
        status="ok",
        service="helmos-agent-gateway",
        timestamp=datetime.now(timezone.utc),
        agents=await registry.list_descriptors(),
    )
