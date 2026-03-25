"""Runtime settings for the HelmOS backend."""

from functools import lru_cache
from typing import cast

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    env: str = Field(default="local", alias="HELMOS_ENV")
    log_level: str = Field(default="INFO", alias="HELMOS_LOG_LEVEL")
    api_prefix: str = Field(default="/api/v1", alias="HELMOS_API_PREFIX")
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/helmos",
        alias="HELMOS_DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="HELMOS_REDIS_URL")
    s3_endpoint_url: str | None = Field(default=None, alias="HELMOS_S3_ENDPOINT_URL")
    s3_bucket: str = Field(default="helmos-artifacts", alias="HELMOS_S3_BUCKET")
    s3_access_key: str | None = Field(default=None, alias="HELMOS_S3_ACCESS_KEY")
    s3_secret_key: str | None = Field(default=None, alias="HELMOS_S3_SECRET_KEY")
    langsmith_enabled: bool = Field(default=False, alias="HELMOS_LANGSMITH_ENABLED")
    langsmith_api_key: str | None = Field(default=None, alias="HELMOS_LANGSMITH_API_KEY")
    langsmith_project: str = Field(
        default="helmos-agentic-layer",
        alias="HELMOS_LANGSMITH_PROJECT",
    )
    llm_gateway_provider: str = Field(default="litellm_proxy", alias="HELMOS_LLM_GATEWAY_PROVIDER")
    litellm_proxy_url: str = Field(default="http://localhost:4000", alias="HELMOS_LITELLM_PROXY_URL")
    litellm_api_key: str = Field(default="sk-helmos-dev", alias="HELMOS_LITELLM_API_KEY")
    litellm_timeout_seconds: float = Field(default=60.0, alias="HELMOS_LITELLM_TIMEOUT_SECONDS")
    default_model: str = Field(default="helmos-default", alias="HELMOS_DEFAULT_MODEL")
    supervisor_model: str = Field(default="helmos-supervisor", alias="HELMOS_SUPERVISOR_MODEL")
    vector_dimensions: int = Field(default=1536, alias="HELMOS_VECTOR_DIMENSIONS")
    enable_approvals: bool = Field(default=True, alias="HELMOS_ENABLE_APPROVALS")
    cors_allowed_origins_raw: str = Field(
        default="http://127.0.0.1:4210,http://localhost:4210,http://127.0.0.1:4200,http://localhost:4200",
        alias="HELMOS_CORS_ALLOWED_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


def get_cors_allowed_origins(settings: Settings) -> list[str]:
    """Return a normalized list of configured CORS origins."""

    values = [origin.strip() for origin in settings.cors_allowed_origins_raw.split(",")]
    return cast(list[str], [origin for origin in values if origin])
