"""Internal tool invocation routes."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import build_tool_registry
from app.tools.base import ToolInvocation, ToolResult


router = APIRouter()


class WebSearchRequest(BaseModel):
    """Typed payload for shared web-search invocation."""

    query: str
    max_results: int = Field(default=5, ge=1, le=10)
    actor: str = "system"


@router.post("/web-search", response_model=ToolResult)
async def search_web(request: WebSearchRequest) -> ToolResult:
    """Invoke the shared web-search tool outside agent execution."""

    registry = build_tool_registry()
    return await registry.invoke(
        ["web_search"],
        ToolInvocation(
            tool_name="web_search",
            action="search",
            payload={
                "query": request.query,
                "max_results": request.max_results,
            },
            actor=request.actor,
        ),
    )
