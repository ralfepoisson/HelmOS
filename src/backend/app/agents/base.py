"""Base specialist agent interface."""

from abc import ABC, abstractmethod
import json

import structlog

from app.schemas.agent import AgentDescriptor, AgentExecutionInput, AgentExecutionOutput
from app.services.llm_gateway import LLMGateway
from app.services.template_renderer import TemplateRenderer
from app.tools.registry import ToolRegistry


logger = structlog.get_logger(__name__)


class SpecialistAgent(ABC):
    """Stable contract for all specialist agents."""

    descriptor: AgentDescriptor
    instruction_template: str

    def __init__(
        self,
        *,
        tool_registry: ToolRegistry,
        template_renderer: TemplateRenderer,
        llm_gateway: LLMGateway,
    ):
        self.tool_registry = tool_registry
        self.template_renderer = template_renderer
        self.llm_gateway = llm_gateway

    @property
    def allowed_tools(self) -> list[str]:
        return self.descriptor.allowed_tools

    def build_prompt(self, execution_input: AgentExecutionInput) -> str:
        chat_history = execution_input.context.get(
            "chat_history",
            execution_input.context.get("recent_messages", []),
        )
        ideation_page_state = execution_input.context.get("ideation_page_state")
        if not isinstance(ideation_page_state, dict):
            ideation_page_state = {
                key: value
                for key, value in execution_input.context.items()
                if key not in {"recent_messages", "chat_history", "latest_user_message"}
            }
        prompt_context = {
            "prompt": execution_input.prompt,
            "context": execution_input.context,
            "constraints": execution_input.constraints,
            "context_json": json.dumps(execution_input.context, ensure_ascii=False, indent=2, sort_keys=True),
            "chat_history_json": json.dumps(chat_history, ensure_ascii=False, indent=2, sort_keys=True),
            "ideation_page_state_json": json.dumps(
                ideation_page_state,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            ),
            "constraints_json": json.dumps(
                execution_input.constraints,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            ),
        }
        return self.template_renderer.render(
            self.instruction_template,
            prompt_context,
        )

    async def generate_text(
        self,
        execution_input: AgentExecutionInput,
        *,
        system_prompt: str,
        temperature: float = 0.2,
    ) -> str | None:
        """Generate optional agent prose through the shared LLM gateway."""

        if not self.llm_gateway.is_enabled:
            return None
        model_name = execution_input.constraints.get("model")
        if not model_name:
            return None
        try:
            return await self.llm_gateway.generate_text(
                model=model_name,
                system_prompt=system_prompt,
                user_prompt=self.build_prompt(execution_input),
                temperature=temperature,
                metadata={
                    "agent_key": self.descriptor.key,
                    "run_id": execution_input.run_id,
                    "session_id": execution_input.session_id,
                },
            )
        except Exception as exc:
            logger.warning(
                "agent.llm_gateway_fallback",
                agent_key=self.descriptor.key,
                run_id=execution_input.run_id,
                error=str(exc),
            )
            return f"[llm_unavailable] {exc}"

    @abstractmethod
    async def execute(self, execution_input: AgentExecutionInput) -> AgentExecutionOutput:
        """Run the specialist agent."""
