"""LLM gateway abstraction backed by LiteLLM proxy."""

import structlog
from openai import AsyncOpenAI


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
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=self.base_url,
            timeout=timeout_seconds,
        )

    @property
    def is_enabled(self) -> bool:
        return self.provider == "litellm_proxy" and bool(self.base_url and self.api_key)

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

        logger.info(
            "llm_gateway.request",
            provider=self.provider,
            model=model,
            metadata=metadata or {},
        )
        response = await self._client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        logger.info(
            "llm_gateway.response",
            provider=self.provider,
            model=model,
            usage=getattr(response, "usage", None),
        )
        return response.choices[0].message.content or ""
