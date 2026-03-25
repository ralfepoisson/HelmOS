"""Shared schema types."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Base schema with ORM support."""

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    """Health endpoint response."""

    status: str
    service: str
    timestamp: datetime


class StatusResponse(BaseModel):
    """Generic status response."""

    status: str
    detail: str | None = None
