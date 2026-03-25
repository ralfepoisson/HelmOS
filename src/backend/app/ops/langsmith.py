"""LangSmith integration hooks."""

from contextlib import asynccontextmanager


class LangSmithTracer:
    """Thin wrapper to keep tracing concerns out of business logic."""

    def __init__(self, *, enabled: bool, project_name: str):
        self.enabled = enabled
        self.project_name = project_name

    @asynccontextmanager
    async def trace(self, run_name: str, metadata: dict | None = None):
        # TODO: wrap LangSmith trace contexts and evaluation hooks.
        yield {"run_name": run_name, "project_name": self.project_name, "metadata": metadata or {}}
