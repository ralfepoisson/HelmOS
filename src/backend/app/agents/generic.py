"""Generic database-backed specialist agent."""

import json
import structlog

from app.agents.base import SpecialistAgent
from app.schemas.agent import (
    AgentDescriptor,
    AgentExecutionInput,
    AgentExecutionOutput,
    ArtifactPayload,
)
from app.schemas.agent_config import AgentRuntimeConfig


logger = structlog.get_logger(__name__)

DEFAULT_IDEATION_OUTPUT_SCHEMA = {
    "reply_to_user": {"content": ""},
    "ideation_overview": {
        "readiness": {
            "label": "",
            "reason": "",
            "next_best_action": "",
        },
    },
    "problem_statement": {
        "content": "",
        "priority": "primary",
        "status": {
            "label": "",
            "tone": "",
            "agent_confidence": "",
            "explanation": "",
        },
        "ui_hints": {"highlight": False, "needs_attention": False},
    },
    "target_customer": {
        "content": "",
        "priority": "primary",
        "status": {
            "label": "",
            "tone": "",
            "agent_confidence": "",
            "explanation": "",
        },
        "ui_hints": {"highlight": False, "needs_attention": False},
    },
    "Value Proposition": {
        "content": "",
        "helper": "",
        "priority": "primary",
        "status": {
            "label": "",
            "tone": "",
            "agent_confidence": "",
            "explanation": "",
        },
        "ui_hints": {"highlight": False, "needs_attention": False},
    },
    "product_service_description": {
        "content": "",
        "priority": "secondary",
        "status": {
            "label": "",
            "tone": "",
            "agent_confidence": "",
            "explanation": "",
        },
        "ui_hints": {"highlight": False, "needs_attention": False},
    },
    "differentiation": {
        "content": "",
        "priority": "secondary",
        "status": {
            "label": "",
            "tone": "",
            "agent_confidence": "",
            "explanation": "",
        },
        "ui_hints": {"highlight": False, "needs_attention": False},
    },
    "early_monitization_idea": {
        "content": "",
        "priority": "secondary",
        "status": {
            "label": "",
            "tone": "",
            "agent_confidence": "",
            "explanation": "",
        },
        "ui_hints": {"highlight": False, "needs_attention": False},
    },
}


def _sanitize_ideation_output_schema(schema: dict | None) -> dict:
    base_schema = schema if isinstance(schema, dict) else DEFAULT_IDEATION_OUTPUT_SCHEMA
    sanitized = json.loads(json.dumps(base_schema))
    overview = sanitized.get("ideation_overview")
    if isinstance(overview, dict):
        overview.pop("completeness_percent", None)

    for key in (
        "problem_statement",
        "target_customer",
        "Value Proposition",
        "product_service_description",
        "differentiation",
        "early_monitization_idea",
        "early_monetization_idea",
    ):
        section = sanitized.get(key)
        if not isinstance(section, dict):
            continue
        status = section.get("status")
        if isinstance(status, dict):
            status.pop("score", None)

    return sanitized

DEFAULT_VALUE_PROPOSITION_OUTPUT_SCHEMA = {
    "customer_profile": {
        "segments": [""],
        "jobs": {
            "functional": [""],
            "emotional": [""],
            "social": [""],
        },
        "pains": [""],
        "gains": [""],
    },
    "value_map": {
        "products_services": [""],
        "pain_relievers": [""],
        "gain_creators": [""],
    },
    "analysis": {
        "weakest_area": "",
        "issues": [""],
        "inconsistencies": [""],
        "recommendations": [""],
    },
    "scoring": {
        "customer_clarity": "",
        "problem_depth": "",
        "value_definition": "",
        "pain_gain_relevance": "",
        "fit_consistency": "",
        "overall": "",
    },
    "next_question": "",
}


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
        self.system_prompt = self._build_system_prompt()
        logger.info(
            "agent.instantiated",
            agent_key=self.descriptor.key,
            agent_name=self.descriptor.name,
            prompt_key=self.config.prompt_key,
            system_prompt=self.system_prompt,
        )

    def _build_system_prompt(self) -> str:
        sections: list[str] = []

        if self.config.system_prompt and self.config.system_prompt.strip():
            sections.append(self.config.system_prompt.strip())
        else:
            prompt_sections = self.config.promptSections
            role_persona = prompt_sections.rolePersona.strip() if prompt_sections and prompt_sections.rolePersona else ""
            task_instructions = (
                prompt_sections.taskInstructions.strip()
                if prompt_sections and prompt_sections.taskInstructions
                else ""
            )
            constraints = (
                prompt_sections.constraints.strip() if prompt_sections and prompt_sections.constraints else ""
            )
            output_format = self._render_output_format_for_prompt()
            purpose = self.config.purpose.strip() if self.config.purpose else ""
            scope_notes = self.config.scopeNotes.strip() if self.config.scopeNotes else ""

            identity_lines = [f"You are the HelmOS {self.descriptor.name}."]
            if purpose:
                identity_lines.append(f"Primary objective: {purpose}")
            if scope_notes:
                identity_lines.append(f"Scope notes: {scope_notes}")
            sections.append("\n".join(identity_lines))

            if role_persona:
                sections.append(f"Role / Persona:\n{role_persona}")
            if task_instructions:
                sections.append(f"Task Instructions:\n{task_instructions}")
            if constraints:
                sections.append(f"Constraints:\n{constraints}")
            if output_format:
                sections.append(f"Output Format:\n{output_format}")

        execution_context_lines: list[str] = []
        if self.descriptor.default_model:
            execution_context_lines.append(f"Default model alias: {self.descriptor.default_model}")
        if self.config.reasoningMode:
            execution_context_lines.append(f"Reasoning mode: {self.config.reasoningMode}")
        if self.config.retryPolicy:
            execution_context_lines.append(f"Retry policy: {self.config.retryPolicy}")
        if self.config.maxSteps is not None:
            execution_context_lines.append(f"Max steps: {self.config.maxSteps}")
        if self.config.timeoutSeconds is not None:
            execution_context_lines.append(f"Timeout (seconds): {self.config.timeoutSeconds}")
        if self.config.lifecycleState:
            execution_context_lines.append(f"Lifecycle state: {self.config.lifecycleState}")
        if execution_context_lines:
            sections.append("Execution Context:\n" + "\n".join(execution_context_lines))

        tool_lines: list[str] = []
        for tool in self.config.toolPermissions:
            label = tool.label or tool.key
            details: list[str] = []
            if tool.access:
                details.append(tool.access)
            if tool.scopePreview:
                details.append(tool.scopePreview)
            if tool.policyFlags:
                details.append("policy flags: " + ", ".join(tool.policyFlags))

            if details:
                tool_lines.append(f"- {label} ({tool.key}): " + "; ".join(details))
            else:
                tool_lines.append(f"- {label} ({tool.key})")

        if tool_lines:
            sections.append("Permitted Tools:\n" + "\n".join(tool_lines))

        if not sections:
            sections.append(
                f"You are the HelmOS {self.descriptor.name}. Produce concise structured founder-facing output."
            )

        return "\n\n".join(section for section in sections if section.strip())

    def _render_output_format_for_prompt(self) -> str:
        prompt_sections = self.config.promptSections
        output_format = (
            prompt_sections.outputFormat.strip()
            if prompt_sections and prompt_sections.outputFormat
            else ""
        )
        if not output_format:
            return ""

        if self.descriptor.key != "ideation":
            return output_format

        try:
            parsed = json.loads(output_format)
        except json.JSONDecodeError:
            return json.dumps(DEFAULT_IDEATION_OUTPUT_SCHEMA, ensure_ascii=False, indent=2)

        return json.dumps(_sanitize_ideation_output_schema(parsed), ensure_ascii=False, indent=2)

    @staticmethod
    def _extract_json_object(raw_text: str | None) -> dict | None:
        if not raw_text:
            return None

        candidate = raw_text.strip()
        if candidate.startswith("```"):
            candidate = candidate.strip("`").strip()
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].strip()

        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return None

        return parsed if isinstance(parsed, dict) else None

    def _expected_output_schema(self) -> dict | None:
        output_format = self._render_output_format_for_prompt()
        if not output_format:
            return None
        try:
            parsed = json.loads(output_format)
        except json.JSONDecodeError:
            if self.descriptor.key == "ideation":
                return _sanitize_ideation_output_schema(DEFAULT_IDEATION_OUTPUT_SCHEMA)
            if self.descriptor.key == "value_proposition":
                return DEFAULT_VALUE_PROPOSITION_OUTPUT_SCHEMA
            return None
        if isinstance(parsed, dict):
            return _sanitize_ideation_output_schema(parsed) if self.descriptor.key == "ideation" else parsed
        if self.descriptor.key == "ideation":
            return _sanitize_ideation_output_schema(DEFAULT_IDEATION_OUTPUT_SCHEMA)
        if self.descriptor.key == "value_proposition":
            return DEFAULT_VALUE_PROPOSITION_OUTPUT_SCHEMA
        return None

    @staticmethod
    def _matches_expected_type(expected, actual) -> bool:
        if expected is None:
            return actual is None
        if isinstance(expected, bool):
            return isinstance(actual, bool)
        if isinstance(expected, (int, float)) and not isinstance(expected, bool):
            return isinstance(actual, (int, float)) and not isinstance(actual, bool)
        if isinstance(expected, str):
            return isinstance(actual, str)
        if isinstance(expected, list):
            return isinstance(actual, list)
        if isinstance(expected, dict):
            return isinstance(actual, dict)
        return True

    @classmethod
    def _validate_against_expected_schema(
        cls,
        expected,
        actual,
        *,
        path: str = "$",
    ) -> tuple[bool, str | None]:
        if isinstance(expected, dict):
            if not isinstance(actual, dict):
                return False, f"{path} must be an object."
            for key, expected_value in expected.items():
                if key not in actual:
                    return False, f"Missing required field: {path}.{key}"
                valid, error = cls._validate_against_expected_schema(
                    expected_value,
                    actual[key],
                    path=f"{path}.{key}",
                )
                if not valid:
                    return valid, error
            return True, None

        if isinstance(expected, list):
            if not isinstance(actual, list):
                return False, f"{path} must be an array."
            if not expected:
                return True, None
            for index, item in enumerate(actual):
                valid, error = cls._validate_against_expected_schema(
                    expected[0],
                    item,
                    path=f"{path}[{index}]",
                )
                if not valid:
                    return valid, error
            return True, None

        if not cls._matches_expected_type(expected, actual):
            expected_type = type(expected).__name__
            return False, f"{path} must be of type {expected_type}."

        return True, None

    @staticmethod
    def _validate_ideation_structured_output(payload: dict | None) -> tuple[bool, str | None]:
        if not isinstance(payload, dict):
            return False, "The response was not a valid JSON object."

        required_sections = [
            "reply_to_user",
            "ideation_overview",
            "problem_statement",
            "target_customer",
            "Value Proposition",
            "product_service_description",
            "differentiation",
        ]

        for key in required_sections:
            if key not in payload or not isinstance(payload.get(key), dict):
                return False, f"Missing required object: {key}"

        if "early_monitization_idea" not in payload and "early_monetization_idea" not in payload:
            return False, "Missing required object: early_monitization_idea"

        reply = payload.get("reply_to_user", {})
        if not isinstance(reply.get("content"), str):
            return False, "reply_to_user.content must be a string."

        overview = payload.get("ideation_overview", {})
        readiness = overview.get("readiness")
        if not isinstance(readiness, dict):
            return False, "ideation_overview.readiness must be an object."

        for field in ("label", "reason", "next_best_action"):
            if not isinstance(readiness.get(field), str):
                return False, f"ideation_overview.readiness.{field} must be a string."

        for section_key in (
            "problem_statement",
            "target_customer",
            "Value Proposition",
            "product_service_description",
            "differentiation",
            "early_monitization_idea" if "early_monitization_idea" in payload else "early_monetization_idea",
        ):
            section = payload.get(section_key)
            if not isinstance(section.get("content"), str):
                return False, f"{section_key}.content must be a string."
            if not isinstance(section.get("priority"), str):
                return False, f"{section_key}.priority must be a string."
            if not isinstance(section.get("status"), dict):
                return False, f"{section_key}.status must be an object."
            if not isinstance(section.get("ui_hints"), dict):
                return False, f"{section_key}.ui_hints must be an object."

        return True, None

    async def _coerce_ideation_structured_output(
        self,
        *,
        execution_input: AgentExecutionInput,
        system_prompt: str,
        llm_output: str | None,
        user_prompt: str,
    ) -> tuple[dict | None, str | None]:
        parsed = self._extract_json_object(llm_output)
        schema = self._expected_output_schema()
        is_valid, error_message = (
            self._validate_against_expected_schema(schema, parsed)
            if schema is not None
            else self._validate_ideation_structured_output(parsed)
        )
        if is_valid:
            return parsed, llm_output

        if not self.llm_gateway.is_enabled:
            return None, llm_output

        model_name = execution_input.constraints.get("model")
        if not model_name:
            return None, llm_output

        corrected_output = await self.llm_gateway.generate_text(
            model=model_name,
            system_prompt=system_prompt,
            temperature=float(self.config.temperature),
            user_prompt=(
                "The previous response did not conform to the required ideation JSON structure.\n\n"
                "Original request sent to the model:\n"
                f"System prompt:\n{system_prompt}\n\n"
                f"User prompt:\n{user_prompt}\n\n"
                "Previous model response:\n"
                f"{llm_output or ''}\n\n"
                "Follow-up instruction:\n"
                "Return valid JSON only.\n"
                "Do not include markdown fences or explanatory text.\n"
                "The response must conform exactly to this JSON structure:\n"
                f"{self._render_output_format_for_prompt() or json.dumps(schema or DEFAULT_IDEATION_OUTPUT_SCHEMA, ensure_ascii=False, indent=2)}\n\n"
                "Validation error:\n"
                f"{error_message}\n"
            ),
            metadata={
                "agent_key": self.descriptor.key,
                "run_id": execution_input.run_id,
                "session_id": execution_input.session_id,
                "correction_attempt": 1,
            },
        )

        corrected_parsed = self._extract_json_object(corrected_output)
        corrected_valid, corrected_error = (
            self._validate_against_expected_schema(schema, corrected_parsed)
            if schema is not None
            else self._validate_ideation_structured_output(corrected_parsed)
        )
        if corrected_valid:
            return corrected_parsed, corrected_output

        raise ValueError(
            "Ideation agent returned invalid structured JSON after a correction attempt: "
            f"{corrected_error}"
        )

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
        user_prompt = self.build_prompt(execution_input)
        llm_output = await self.generate_text(
            execution_input,
            system_prompt=self.system_prompt,
            temperature=float(self.config.temperature),
        )
        llm_error = None
        if isinstance(llm_output, str) and llm_output.startswith("[llm_unavailable] "):
            llm_error = llm_output.removeprefix("[llm_unavailable] ").strip()
            llm_output = None
        structured_output = None
        if self.descriptor.key in {"ideation", "value_proposition"} and llm_output:
            structured_output, llm_output = await self._coerce_ideation_structured_output(
                execution_input=execution_input,
                system_prompt=self.system_prompt,
                llm_output=llm_output,
                user_prompt=user_prompt,
            )
        llm_traces = []
        if hasattr(self.llm_gateway, "consume_run_traces"):
            llm_traces = self.llm_gateway.consume_run_traces(execution_input.run_id)
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
            structured_output=structured_output,
            debug={
                "llm_traces": llm_traces,
                "expected_output_schema": self._expected_output_schema(),
            },
            intermediate_notes=[note for note in notes if note],
            next_actions=self.config.next_actions,
            requires_approval=self.config.requires_approval,
            approval_reason=self.config.approval_reason,
            requested_tools=[],
        )
