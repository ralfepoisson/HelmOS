"""LLM gateway abstraction backed by LiteLLM proxy."""

import structlog
from openai import AsyncOpenAI

from app.services.runtime_log import persist_run_audit_log, persist_runtime_log

logger = structlog.get_logger(__name__)


class LLMGateway:
    """OpenAI-compatible gateway client.

    By default this talks to a LiteLLM proxy so provider routing and secrets
    stay outside the HelmOS agent runtime.
    """

    def __init__(
        self,
        *,
        provider: str,
        base_url: str,
        api_key: str,
        timeout_seconds: float,
    ):
        self.provider = provider
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self._run_traces: dict[str, list[dict]] = {}
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=self.base_url,
            timeout=timeout_seconds,
        )

    @property
    def is_enabled(self) -> bool:
        return self.provider == "litellm_proxy" and bool(self.base_url and self.api_key)

    def _append_run_trace(self, run_id: str | None, trace: dict) -> None:
        if not run_id:
            return
        self._run_traces.setdefault(run_id, []).append(trace)

    def consume_run_traces(self, run_id: str | None) -> list[dict]:
        if not run_id:
            return []
        return list(self._run_traces.pop(run_id, []))

    async def generate_text(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        metadata: dict | None = None,
    ) -> str:
        """Generate text through the configured gateway."""

        run_id = str((metadata or {}).get("run_id") or "") or None
        session_id = str((metadata or {}).get("session_id") or "") or None
        request_payload = {
            "model": model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        await persist_runtime_log(
            level="info",
            scope="llm-gateway",
            event="llm_completion_requested",
            message=f"Requested LLM completion for model {model}",
            context={
                "provider": self.provider,
                "base_url": self.base_url,
                "model": model,
                "temperature": temperature,
                "metadata": metadata or {},
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            },
        )
        await persist_run_audit_log(
            run_id=run_id,
            session_id=session_id,
            actor="llm-gateway",
            event_type="llm.completion_requested",
            message=f"Requested LLM completion for model {model}",
            payload={
                "provider": self.provider,
                "base_url": self.base_url,
                "model": model,
                "temperature": temperature,
                "metadata": metadata or {},
                "request": request_payload,
            },
        )
        self._append_run_trace(
            run_id,
            {
                "event_type": "llm.completion_requested",
                "actor": "llm-gateway",
                "message": f"Requested LLM completion for model {model}",
                "payload": {
                    "provider": self.provider,
                    "base_url": self.base_url,
                    "model": model,
                    "temperature": temperature,
                    "metadata": metadata or {},
                    "request": request_payload,
                },
            },
        )
        logger.info(
            "llm_gateway.request",
            provider=self.provider,
            model=model,
            metadata=metadata or {},
        )
        try:
            response = await self._client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            await persist_runtime_log(
                level="error",
                scope="llm-gateway",
                event="llm_completion_failed",
                message=f"LLM completion failed for model {model}",
                context={
                    "provider": self.provider,
                    "base_url": self.base_url,
                    "model": model,
                    "temperature": temperature,
                    "metadata": metadata or {},
                    "system_prompt": system_prompt,
                    "user_prompt": user_prompt,
                    "error": str(exc),
                },
            )
            await persist_run_audit_log(
                run_id=run_id,
                session_id=session_id,
                actor="llm-gateway",
                event_type="llm.completion_failed",
                message=f"LLM completion failed for model {model}",
                payload={
                    "provider": self.provider,
                    "base_url": self.base_url,
                    "model": model,
                    "temperature": temperature,
                    "metadata": metadata or {},
                    "request": request_payload,
                    "error": str(exc),
                },
            )
            self._append_run_trace(
                run_id,
                {
                    "event_type": "llm.completion_failed",
                    "actor": "llm-gateway",
                    "message": f"LLM completion failed for model {model}",
                    "payload": {
                        "provider": self.provider,
                        "base_url": self.base_url,
                        "model": model,
                        "temperature": temperature,
                        "metadata": metadata or {},
                        "request": request_payload,
                        "error": str(exc),
                    },
                },
            )
            raise
        logger.info(
            "llm_gateway.response",
            provider=self.provider,
            model=model,
            usage=getattr(response, "usage", None),
        )
        content = response.choices[0].message.content or ""
        await persist_runtime_log(
            level="info",
            scope="llm-gateway",
            event="llm_completion_succeeded",
            message=f"LLM completion succeeded for model {model}",
            context={
                "provider": self.provider,
                "base_url": self.base_url,
                "model": model,
                "temperature": temperature,
                "metadata": metadata or {},
                "usage": getattr(response, "usage", None),
                "response_preview": content,
            },
        )
        await persist_run_audit_log(
            run_id=run_id,
            session_id=session_id,
            actor="llm-gateway",
            event_type="llm.completion_succeeded",
            message=f"LLM completion succeeded for model {model}",
            payload={
                "provider": self.provider,
                "base_url": self.base_url,
                "model": model,
                "temperature": temperature,
                "metadata": metadata or {},
                "request": request_payload,
                "response": response.model_dump(mode="json") if hasattr(response, "model_dump") else None,
                "response_content": content,
                "usage": getattr(response, "usage", None),
            },
        )
        self._append_run_trace(
            run_id,
            {
                "event_type": "llm.completion_succeeded",
                "actor": "llm-gateway",
                "message": f"LLM completion succeeded for model {model}",
                "payload": {
                    "provider": self.provider,
                    "base_url": self.base_url,
                    "model": model,
                    "temperature": temperature,
                    "metadata": metadata or {},
                    "request": request_payload,
                    "response": response.model_dump(mode="json") if hasattr(response, "model_dump") else None,
                    "response_content": content,
                    "usage": getattr(response, "usage", None),
                },
            },
        )
        return content
