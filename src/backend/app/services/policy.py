"""Policy and guardrail service abstraction."""


class PolicyGuardrailService:
    """Determine whether outputs or actions need approval."""

    def evaluate(self, *, route: str, normalized_output: dict, run_context: dict) -> dict:
        artifact_kind = normalized_output.get("artifact", {}).get("kind")
        requested_tools = normalized_output.get("requested_tools", [])
        explicit_approval = normalized_output.get("requires_approval", False)
        risky_action = explicit_approval or route == "workflow" or artifact_kind == "roadmap" or bool(requested_tools)
        return {
            "allowed": True,
            "requires_approval": risky_action and run_context.get("approvals_enabled", True),
            "reason": (
                normalized_output.get("approval_reason")
                or "Roadmap and multi-step workflow outputs should be reviewed before release."
                if risky_action
                else None
            ),
        }
