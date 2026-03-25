"""Retrieval access abstraction."""


class RetrievalSupport:
    """Placeholder retrieval service.

    Structured business truth lives in relational models. Retrieval augments it.
    """

    async def search(self, query: str, *, session_id: str | None = None) -> list[dict]:
        return [
            {
                "title": "Retrieval pipeline placeholder",
                "content": f"No live retrieval connected yet for query: {query}",
                "session_id": session_id,
            }
        ]
