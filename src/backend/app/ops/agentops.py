"""AgentOps placeholders for release controls and evaluations."""


class AgentOpsRegistry:
    """Placeholder surface for evaluation datasets and release controls."""

    def evaluation_hooks(self) -> dict:
        return {
            "datasets": [],
            "release_controls": [],
            "note": "TODO: connect prompt release controls and offline evaluation datasets.",
        }
