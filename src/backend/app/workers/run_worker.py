"""Simple background execution helper."""

import structlog


logger = structlog.get_logger(__name__)


class RunWorker:
    """Wrapper for background workflow execution."""

    def __init__(self, runtime):
        self.runtime = runtime

    async def execute(self, state: dict) -> dict:
        logger.info("run_worker.execute", run_id=state.get("run_id"))
        return await self.runtime.execute(state)
