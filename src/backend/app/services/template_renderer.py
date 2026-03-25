"""Prompt/template rendering utilities."""

from collections import defaultdict


class TemplateRenderer:
    """Simple deterministic string templating."""

    def render(self, template: str, context: dict) -> str:
        safe_context = defaultdict(str, context)
        return template.format_map(safe_context)
