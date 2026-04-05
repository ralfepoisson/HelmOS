"""Prompt/template rendering utilities."""

from collections import defaultdict
import re


PLACEHOLDER_PATTERN = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")


class TemplateRenderer:
    """Simple deterministic string templating."""

    def has_placeholders(self, template: str) -> bool:
        return bool(PLACEHOLDER_PATTERN.search(template or ""))

    def render(self, template: str, context: dict) -> str:
        safe_context = defaultdict(str, context)
        return PLACEHOLDER_PATTERN.sub(
            lambda match: str(safe_context[match.group(1)]),
            template,
        )
