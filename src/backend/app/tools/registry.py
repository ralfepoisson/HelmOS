"""Registry that enforces allowed-tool boundaries."""

from app.tools.base import ToolAdapter, ToolInvocation, ToolResult


class ToolRegistry:
    """Controlled registry for agent-visible tools."""

    def __init__(self, adapters: list[ToolAdapter] | None = None):
        self._adapters: dict[str, ToolAdapter] = {}
        for adapter in adapters or []:
            self.register(adapter)

    def register(self, adapter: ToolAdapter) -> None:
        self._adapters[adapter.name] = adapter

    def list_tools(self) -> list[dict]:
        return [adapter.describe() for adapter in self._adapters.values()]

    async def invoke(self, allowed_tools: list[str], invocation: ToolInvocation) -> ToolResult:
        if invocation.tool_name not in allowed_tools:
            raise PermissionError(
                f"Tool '{invocation.tool_name}' is not permitted for this agent execution."
            )
        adapter = self._adapters.get(invocation.tool_name)
        if adapter is None:
            raise LookupError(f"Tool adapter '{invocation.tool_name}' is not registered.")
        return await adapter.invoke(invocation)
