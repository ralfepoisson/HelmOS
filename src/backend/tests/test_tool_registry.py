import pytest

from app.tools.adapters import RetrievalAdapter
from app.tools.base import ToolInvocation
from app.tools.registry import ToolRegistry


@pytest.mark.asyncio
async def test_tool_registry_blocks_unapproved_tool():
    registry = ToolRegistry(adapters=[RetrievalAdapter()])

    with pytest.raises(PermissionError):
        await registry.invoke(
            ["web_search"],
            ToolInvocation(tool_name="retrieval", action="search", payload={"query": "x"}),
        )
