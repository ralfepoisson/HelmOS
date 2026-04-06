"""Tool adapters with controlled contracts."""

import html
import os
import re
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from app.tools.base import ToolAdapter, ToolInvocation, ToolResult


class WebSearchAdapter(ToolAdapter):
    name = "web_search"
    description = "Controlled web search adapter."

    async def _search_duckduckgo(self, query: str, *, max_results: int) -> list[dict]:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
                headers={
                    "User-Agent": "HelmOS/0.1 (+https://helm-os.ai)",
                },
            )
            response.raise_for_status()

        return self._parse_duckduckgo_results(response.text, max_results=max_results)

    def _parse_duckduckgo_results(self, body: str, *, max_results: int) -> list[dict]:
        results: list[dict] = []
        pattern = re.compile(
            r'<a[^>]*class="result__a"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>.*?'
            r'(?:(?:<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>)(?P<snippet>.*?)</(?:a|div)>)?',
            re.IGNORECASE | re.DOTALL,
        )

        for match in pattern.finditer(body):
            resolved_url = self._resolve_duckduckgo_url(match.group("href"))
            if not resolved_url:
                continue

            title = self._clean_html_text(match.group("title"))
            snippet = self._clean_html_text(match.group("snippet") or "")
            if not title:
                continue

            results.append(
                {
                    "title": title,
                    "url": resolved_url,
                    "snippet": snippet,
                    "provider": "duckduckgo",
                    "rank": len(results) + 1,
                }
            )
            if len(results) >= max_results:
                break

        return results

    def _resolve_duckduckgo_url(self, href: str) -> str | None:
        candidate = html.unescape(href or "").strip()
        if not candidate:
            return None

        parsed = urlparse(candidate)
        if parsed.netloc.endswith("duckduckgo.com") and parsed.path == "/y.js":
            return None

        if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
            encoded_target = parse_qs(parsed.query).get("uddg", [None])[0]
            if encoded_target:
                return unquote(encoded_target)

        return candidate

    def _clean_html_text(self, value: str) -> str:
        text = re.sub(r"<[^>]+>", " ", value or "")
        text = html.unescape(text)
        return re.sub(r"\s+", " ", text).strip()

    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        query = str(invocation.payload.get("query") or "").strip()
        raw_max_results = invocation.payload.get("max_results", 5)
        try:
            max_results = max(1, min(int(raw_max_results), 10))
        except (TypeError, ValueError):
            max_results = 5

        if invocation.action != "search":
            return ToolResult(
                tool_name=self.name,
                action=invocation.action,
                success=False,
                payload={
                    "query": query,
                    "results": [],
                },
                message="Unsupported web search action.",
            )

        if not query:
            return ToolResult(
                tool_name=self.name,
                action=invocation.action,
                success=False,
                payload={
                    "query": query,
                    "results": [],
                },
                message="Web search requires a non-empty query.",
            )

        results = await self._search_duckduckgo(query, max_results=max_results)
        return ToolResult(
            tool_name=self.name,
            action=invocation.action,
            success=True,
            payload={
                "query": query,
                "max_results": max_results,
                "results": results,
                "provider": "duckduckgo",
            },
            message=f"Web search executed for query '{query}'.",
        )


class RetrievalAdapter(ToolAdapter):
    name = "retrieval"
    description = "Semantic and structured retrieval adapter."

    async def invoke(self, invocation: ToolInvocation) -> ToolResult:
        base_url = os.getenv("HELMOS_NODE_CONTROL_PLANE_URL", "http://127.0.0.1:3001").rstrip("/")
        api_key = os.getenv("KNOWLEDGE_BASE_TOOL_API_KEY", "").strip()

        if not api_key:
            return ToolResult(
                tool_name=self.name,
                action=invocation.action,
                success=False,
                payload={"note": "KNOWLEDGE_BASE_TOOL_API_KEY is not configured."},
                message="Retrieval tool is unavailable because the internal tool API key is missing.",
            )

        headers = {"x-helmos-tool-key": api_key}
        agent_key = str(invocation.payload.get("agent_key") or invocation.actor or "").strip()

        async with httpx.AsyncClient(timeout=20.0) as client:
            if invocation.action == "search":
                response = await client.post(
                    f"{base_url}/api/tools/knowledge-base/search",
                    headers=headers,
                    json={
                        "agentKey": agent_key,
                        "query": invocation.payload.get("query"),
                        "knowledgeBaseIds": invocation.payload.get("knowledge_base_ids") or [],
                        "tags": invocation.payload.get("tags") or [],
                        "limit": invocation.payload.get("limit", 5),
                    },
                )
            elif invocation.action == "get_file_metadata":
                file_id = str(invocation.payload.get("file_id") or "").strip()
                response = await client.get(
                    f"{base_url}/api/tools/knowledge-base/files/{file_id}",
                    headers=headers,
                    params={"agentKey": agent_key},
                )
            elif invocation.action == "get_file_chunks":
                file_id = str(invocation.payload.get("file_id") or "").strip()
                response = await client.get(
                    f"{base_url}/api/tools/knowledge-base/files/{file_id}/chunks",
                    headers=headers,
                    params={
                        "agentKey": agent_key,
                        "limit": invocation.payload.get("limit", 20),
                        "offset": invocation.payload.get("offset", 0),
                    },
                )
            else:
                return ToolResult(
                    tool_name=self.name,
                    action=invocation.action,
                    success=False,
                    payload={},
                    message="Unsupported retrieval action.",
                )

        if response.status_code >= 400:
            return ToolResult(
                tool_name=self.name,
                action=invocation.action,
                success=False,
                payload={"status_code": response.status_code, "body": response.text},
                message="Knowledge base retrieval request failed.",
            )

        payload = response.json().get("data")
        return ToolResult(
            tool_name=self.name,
            action=invocation.action,
            success=True,
            payload={"result": payload},
            message="Knowledge base retrieval executed.",
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
