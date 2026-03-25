"""Placeholder tool adapters with controlled contracts."""

from app.tools.base import ToolAdapter, ToolInvocation, ToolResult


class WebSearchAdapter(ToolAdapter):
    name = "web_search"
    description = "Controlled web search adapter."

    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        return ToolResult(
            tool_name=self.name,
            action=invocation.action,
            success=True,
            payload={
                "query": invocation.payload.get("query"),
                "results": [],
                "note": "TODO: connect provider-backed web search.",
            },
            message="Web search placeholder executed.",
        )


class RetrievalAdapter(ToolAdapter):
    name = "retrieval"
    description = "Semantic and structured retrieval adapter."

    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        return ToolResult(
            tool_name=self.name,
            action=invocation.action,
            success=True,
            payload={
                "query": invocation.payload.get("query"),
                "documents": [],
                "note": "TODO: connect pgvector-backed retrieval pipeline.",
            },
            message="Retrieval placeholder executed.",
        )


class StorageAdapter(ToolAdapter):
    name = "object_storage"
    description = "Object/file storage adapter."

    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        return ToolResult(
            tool_name=self.name,
            action=invocation.action,
            success=True,
            payload={
                "uri": invocation.payload.get("uri"),
                "note": "TODO: connect S3-compatible storage provider.",
            },
            message="Storage placeholder executed.",
        )


class CommunicationsAdapter(ToolAdapter):
    name = "communications"
    description = "Controlled email/calendar adapter."

    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        return ToolResult(
            tool_name=self.name,
            action=invocation.action,
            success=True,
            payload={
                "channel": invocation.payload.get("channel", "email"),
                "note": "TODO: connect email/calendar integrations behind policy checks.",
            },
            message="Communications placeholder executed.",
        )
