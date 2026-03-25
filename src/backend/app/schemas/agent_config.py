"""Validated runtime configuration for database-registered agents."""

from pydantic import BaseModel, Field


class PromptSectionsConfig(BaseModel):
    """Structured prompt sections captured in the admin UI."""

    rolePersona: str | None = None
    taskInstructions: str | None = None
    constraints: str | None = None
    outputFormat: str | None = None


class ToolPermissionConfig(BaseModel):
    """Summarized tool permission metadata captured in the admin UI."""

    key: str
    label: str | None = None
    access: str | None = None
    scopePreview: str | None = None
    policyFlags: list[str] = Field(default_factory=list)


class OutputSectionConfig(BaseModel):
    """Defines one rendered section in a generic runtime artifact."""

    heading: str = "Section"
    template: str = "{llm_output}"


class AgentRuntimeConfig(BaseModel):
    """Supported config keys for the generic runtime agent."""

    system_prompt: str | None = None
    purpose: str | None = None
    scopeNotes: str | None = None
    lifecycleState: str | None = None
    reasoningMode: str | None = None
    retryPolicy: str | None = None
    maxSteps: int | None = None
    timeoutSeconds: int | None = None
    promptSections: PromptSectionsConfig | None = None
    toolPermissions: list[ToolPermissionConfig] = Field(default_factory=list)
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
