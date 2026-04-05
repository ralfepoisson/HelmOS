import pytest

from app.tools.adapters import WebSearchAdapter
from app.tools.base import ToolInvocation


@pytest.mark.asyncio
async def test_web_search_adapter_returns_normalized_results(monkeypatch):
    adapter = WebSearchAdapter()

    async def _fake_search(_query: str, *, max_results: int):
        assert max_results == 2
        return [
            {
                "title": "Manual invoice follow-up remains painful",
                "url": "https://example.com/manual-invoice-follow-up",
                "snippet": "Operators still complain about spreadsheet-driven invoice chasing.",
                "provider": "duckduckgo",
                "rank": 1,
            },
            {
                "title": "VAT reminders are still handled manually",
                "url": "https://example.com/vat-reminders",
                "snippet": "Recurring VAT reminder work keeps surfacing in operator discussions.",
                "provider": "duckduckgo",
                "rank": 2,
            },
        ]

    monkeypatch.setattr(adapter, "_search_duckduckgo", _fake_search)

    result = await adapter.invoke(
        ToolInvocation(
            tool_name="web_search",
            action="search",
            payload={"query": "manual invoice follow up small business", "max_results": 2},
        )
    )

    assert result.success is True
    assert result.payload["query"] == "manual invoice follow up small business"
    assert len(result.payload["results"]) == 2
    assert result.payload["results"][0]["url"] == "https://example.com/manual-invoice-follow-up"
    assert result.payload["results"][1]["provider"] == "duckduckgo"
