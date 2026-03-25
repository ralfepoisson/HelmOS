"""Health routes."""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.common import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Simple health check endpoint."""

    return HealthResponse(
        status="ok",
        service="helmos-agent-gateway",
        timestamp=datetime.now(timezone.utc),
    )
