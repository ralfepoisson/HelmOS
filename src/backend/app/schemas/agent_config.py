"""Validated runtime configuration for database-registered agents."""

from pydantic import BaseModel, Field


class OutputSectionConfig(BaseModel):
    """Defines one rendered section in a generic runtime artifact."""

    heading: str = "Section"
    template: str = "{llm_output}"


class AgentRuntimeConfig(BaseModel):
    """Supported config keys for the generic runtime agent."""

    system_prompt: str | None = None
    temperature: float = 0.2
    artifact_kind: str | None = None
    artifact_title: str | None = None
    artifact_summary: str | None = None
    fallback_template: str = "{prompt}"
    output_sections: list[OutputSectionConfig] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    requires_approval: bool = False
    approval_reason: str | None = None
    prompt_key: str | None = None
