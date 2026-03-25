"""Tool abstraction layer."""

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class ToolInvocation(BaseModel):
    """Normalized request for a controlled tool call."""

    tool_name: str
    action: str
    payload: dict = Field(default_factory=dict)
    actor: str = "agent"


class ToolResult(BaseModel):
    """Normalized result returned by a tool adapter."""

    tool_name: str
    action: str
    success: bool
    payload: dict = Field(default_factory=dict)
    message: str | None = None


class ToolAdapter(ABC):
    """Base interface for tool adapters."""

    name: str
    description: str

    @abstractmethod
    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        """Execute a tool request."""

    def describe(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description}
