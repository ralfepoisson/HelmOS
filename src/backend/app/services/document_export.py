"""Document export abstraction."""


class DocumentExportService:
    """Placeholder export service abstraction."""

    async def export(self, artifact: dict, *, format_name: str = "json") -> dict:
        return {
            "format": format_name,
            "content": artifact,
            "note": "TODO: implement markdown, PDF, and docx exporters.",
        }
