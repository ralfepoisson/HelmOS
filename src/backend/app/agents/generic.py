"""Generic database-backed specialist agent."""

from app.agents.base import SpecialistAgent
from app.schemas.agent import (
    AgentDescriptor,
    AgentExecutionInput,
    AgentExecutionOutput,
    ArtifactPayload,
)
from app.schemas.agent_config import AgentRuntimeConfig


class GenericSpecialistAgent(SpecialistAgent):
    """Runtime agent assembled from database-backed registration records."""

    def __init__(
        self,
        *,
        descriptor: AgentDescriptor,
        instruction_template: str,
        config_json: dict,
        tool_registry,
        template_renderer,
        llm_gateway,
    ):
        super().__init__(
            tool_registry=tool_registry,
            template_renderer=template_renderer,
            llm_gateway=llm_gateway,
        )
        self.descriptor = descriptor
        self.instruction_template = instruction_template
        self.config = AgentRuntimeConfig.model_validate(config_json or {})
        self.config_json = self.config.model_dump()

    def _build_sections(
        self,
        *,
        execution_input: AgentExecutionInput,
        llm_output: str | None,
    ) -> list[dict]:
        configured_sections = self.config.output_sections
        if configured_sections:
            rendered_sections = []
            for section in configured_sections:
                rendered_sections.append(
                    {
                        "heading": section.heading,
                        "content": self.template_renderer.render(
                            section.template,
                            {
                                "prompt": execution_input.prompt,
                                "context": execution_input.context,
                                "constraints": execution_input.constraints,
                                "llm_output": llm_output or "",
                                "agent_name": self.descriptor.name,
                            },
                        ),
                    }
                )
            if rendered_sections:
                return rendered_sections

        return [
            {"heading": "Request", "content": execution_input.prompt},
            {
                "heading": "Generated Output",
                "content": llm_output
                or self.template_renderer.render(
                    self.config.fallback_template,
                    {
                        "prompt": execution_input.prompt,
                        "context": execution_input.context,
                        "constraints": execution_input.constraints,
                        "agent_name": self.descriptor.name,
                    },
                ),
            },
        ]

    async def execute(self, execution_input: AgentExecutionInput) -> AgentExecutionOutput:
        system_prompt = (
            self.config.system_prompt
            or (
                f"You are the HelmOS {self.descriptor.name}. "
                "Produce concise structured founder-facing output."
            )
        )
        llm_output = await self.generate_text(
            execution_input,
            system_prompt=system_prompt,
            temperature=float(self.config.temperature),
        )
        llm_error = None
        if isinstance(llm_output, str) and llm_output.startswith("[llm_unavailable] "):
            llm_error = llm_output.removeprefix("[llm_unavailable] ").strip()
            llm_output = None
        artifact = ArtifactPayload(
            title=self.config.artifact_title or self.descriptor.name,
            kind=execution_input.requested_artifact_kind
            or self.config.artifact_kind
            or self.descriptor.key,
            summary=self.config.artifact_summary or self.descriptor.purpose,
            sections=self._build_sections(execution_input=execution_input, llm_output=llm_output),
            metadata={
                "agent_key": self.descriptor.key,
                "prompt_key": self.config.prompt_key,
                "runtime_mode": "database_registered",
                "llm_error": llm_error,
            },
        )
        notes = [
            "Runtime agent loaded from database registration.",
            "LLM output requested through LiteLLM proxy."
            if llm_output
            else "Using deterministic fallback output.",
            f"LLM gateway fallback reason: {llm_error}" if llm_error else None,
        ]
        return AgentExecutionOutput(
            agent_key=self.descriptor.key,
            version=self.descriptor.version,
            artifact=artifact,
            intermediate_notes=[note for note in notes if note],
            next_actions=self.config.next_actions,
            requires_approval=self.config.requires_approval,
            approval_reason=self.config.approval_reason,
            requested_tools=[],
        )
