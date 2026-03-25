"""Deterministic rules and scoring service."""


class RulesScoringService:
    """Small deterministic ruleset for routing and policy hints."""

    def classify(
        self,
        text: str,
        requested_agent: str | None = None,
        *,
        available_agents: list[dict] | None = None,
    ) -> dict:
        lowered = text.lower()
        available_agent_keys = {
            str(agent.get("key"))
            for agent in (available_agents or [])
            if agent.get("key")
        }
        if requested_agent:
            if not available_agent_keys or requested_agent in available_agent_keys:
                return {"route": "agent", "agent_key": requested_agent, "confidence": 0.95}
            return {"route": "deterministic", "agent_key": None, "confidence": 0.1}
        for agent in available_agents or []:
            key = str(agent.get("key", "")).lower()
            name = str(agent.get("name", "")).lower()
            purpose = str(agent.get("purpose", "")).lower()
            if key and (key in lowered or any(token and token in lowered for token in name.split())):
                return {"route": "agent", "agent_key": agent.get("key"), "confidence": 0.9}
            if purpose:
                purpose_tokens = [token for token in purpose.replace(",", " ").split() if len(token) > 4]
                if any(token in lowered for token in purpose_tokens[:5]):
                    return {"route": "agent", "agent_key": agent.get("key"), "confidence": 0.68}
        if "compare" in lowered and "roadmap" in lowered:
            return {"route": "workflow", "agent_key": "research", "confidence": 0.7}
        if "roadmap" in lowered:
            return {"route": "agent", "agent_key": "roadmap", "confidence": 0.84}
        if "research" in lowered or "competitor" in lowered or "market" in lowered:
            return {"route": "agent", "agent_key": "research", "confidence": 0.82}
        if "brief" in lowered or "idea" in lowered or "concept" in lowered:
            return {"route": "agent", "agent_key": "ideation", "confidence": 0.8}
        return {"route": "deterministic", "agent_key": None, "confidence": 0.55}

    def score_risk(self, payload: dict) -> dict:
        externally_visible = payload.get("externally_visible", False)
        modifies_records = payload.get("modifies_records", False)
        score = 0
        if externally_visible:
            score += 50
        if modifies_records:
            score += 30
        if payload.get("tool_calls"):
            score += 10
        return {"score": score, "requires_approval": score >= 50}
