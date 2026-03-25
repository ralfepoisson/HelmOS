"""Model routing abstraction."""


class ModelRouter:
    """Centralize model selection decisions."""

    def __init__(self, default_model: str, supervisor_model: str):
        self.default_model = default_model
        self.supervisor_model = supervisor_model
        self.research_model = "helmos-research"

    def for_supervisor(self) -> str:
        return self.supervisor_model

    def for_agent(self, agent_key: str, requested_model: str | None = None) -> str:
        if requested_model:
            return requested_model
        if agent_key == "research":
            return self.research_model
        return self.default_model
