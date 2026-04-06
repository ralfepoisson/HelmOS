"""Runtime settings for the HelmOS backend."""

from functools import lru_cache
import os
from pathlib import Path
from typing import cast
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/helmos"
REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV_FILES = (
    str(BACKEND_ROOT / ".env"),
    str(REPO_ROOT / ".env"),
)


@lru_cache(maxsize=None)
def _read_env_file(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    candidate = Path(path)
    if not candidate.exists():
        return values

    for raw_line in candidate.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        value = raw_value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


def read_explicit_setting(key: str, *, env_files: tuple[str, ...] = DEFAULT_ENV_FILES) -> str | None:
    env_value = os.environ.get(key)
    if env_value is not None and env_value.strip():
        return env_value.strip()

    for path in env_files:
        value = _read_env_file(path).get(key)
        if value is not None and value.strip():
            return value.strip()

    return None


def normalize_database_url(value: str | None) -> str:
    """Normalize Prisma-style Postgres URLs for SQLAlchemy/psycopg."""

    normalized = (value or "").strip()
    if not normalized:
        return DEFAULT_DATABASE_URL

    if normalized.startswith("postgresql://"):
        normalized = f"postgresql+psycopg://{normalized.removeprefix('postgresql://')}"

    parts = urlsplit(normalized)
    query_items = parse_qsl(parts.query, keep_blank_values=True)
    schema_name: str | None = None
    options_items: list[tuple[str, str]] = []

    for key, item_value in query_items:
        if key == "schema":
            schema_name = item_value.strip() or None
            continue
        options_items.append((key, item_value))

    if schema_name and not any(key == "options" for key, _ in options_items):
        options_items.append(("options", f"-csearch_path={schema_name}"))

    return urlunsplit(parts._replace(query=urlencode(options_items)))


def resolve_database_url(
    database_url: str | None,
    prisma_database_url: str | None,
) -> str:
    """Prefer the gateway-specific URL when present, otherwise reuse Prisma's DATABASE_URL."""

    normalized_database_url = (database_url or "").strip()
    normalized_prisma_url = (prisma_database_url or "").strip()

    if normalized_prisma_url and (
        not normalized_database_url
        or normalized_database_url == DEFAULT_DATABASE_URL
    ):
        preferred = normalized_prisma_url
    else:
        preferred = normalized_database_url

    return normalize_database_url(preferred)


def resolve_registry_database_url(
    registry_database_url: str | None,
    database_url: str | None,
    prisma_database_url: str | None,
    *,
    env: str = "local",
) -> str:
    """Resolve the registry database separately from the runtime persistence database."""

    normalized_registry_database_url = (registry_database_url or "").strip()
    normalized_database_url = normalize_database_url(database_url)
    normalized_prisma_url = (prisma_database_url or "").strip()

    if normalized_registry_database_url:
        return normalize_database_url(normalized_registry_database_url)

    if env.lower() == "local" and normalized_prisma_url:
        return normalize_database_url(normalized_prisma_url)

    return normalized_database_url


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    env: str = Field(default="local", alias="HELMOS_ENV")
    log_level: str = Field(default="INFO", alias="HELMOS_LOG_LEVEL")
    api_prefix: str = Field(default="/api/v1", alias="HELMOS_API_PREFIX")
    runtime_database_url: str = Field(
        default=DEFAULT_DATABASE_URL,
        alias="HELMOS_DATABASE_URL",
        validation_alias="HELMOS_DATABASE_URL",
    )
    registry_database_url: str | None = Field(
        default=None,
        alias="HELMOS_REGISTRY_DATABASE_URL",
        validation_alias="HELMOS_REGISTRY_DATABASE_URL",
    )
    prisma_database_url: str | None = Field(
        default=None,
        alias="DATABASE_URL",
        validation_alias="DATABASE_URL",
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
    jina_api_key: str | None = Field(default=None, alias="JINA_API_KEY")
    jina_base_url: str = Field(default="https://api.jina.ai/v1/embeddings", alias="JINA_EMBEDDINGS_BASE_URL")
    jina_embedding_model: str = Field(default="jina-embeddings-v4", alias="KNOWLEDGE_BASE_EMBEDDING_MODEL")
    jina_embedding_dimensions: int = Field(default=2048, alias="KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS")
    vector_dimensions: int = Field(default=1536, alias="HELMOS_VECTOR_DIMENSIONS")
    enable_approvals: bool = Field(default=True, alias="HELMOS_ENABLE_APPROVALS")
    agent_test_worker_enabled: bool = Field(default=True, alias="HELMOS_AGENT_TEST_WORKER_ENABLED")
    agent_test_worker_poll_seconds: float = Field(default=2.0, alias="HELMOS_AGENT_TEST_WORKER_POLL_SECONDS")
    cors_allowed_origins_raw: str = Field(
        default="http://127.0.0.1:4210,http://localhost:4210,http://127.0.0.1:4200,http://localhost:4200",
        alias="HELMOS_CORS_ALLOWED_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=DEFAULT_ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def apply_database_url_fallback(self) -> "Settings":
        """Normalize runtime and registry database URLs."""

        explicit_runtime_database_url = read_explicit_setting("HELMOS_DATABASE_URL")
        explicit_registry_database_url = read_explicit_setting("HELMOS_REGISTRY_DATABASE_URL")
        explicit_prisma_database_url = (
            os.environ.get("DATABASE_URL")
            or _read_env_file(str(REPO_ROOT / ".env")).get("DATABASE_URL")
            or _read_env_file(str(BACKEND_ROOT / ".env")).get("DATABASE_URL")
        )

        if explicit_runtime_database_url:
            self.runtime_database_url = normalize_database_url(explicit_runtime_database_url)
        else:
            self.runtime_database_url = resolve_database_url(
                self.runtime_database_url,
                explicit_prisma_database_url or self.prisma_database_url,
            )
        self.registry_database_url = resolve_registry_database_url(
            explicit_registry_database_url or self.registry_database_url,
            self.runtime_database_url,
            explicit_prisma_database_url or self.prisma_database_url,
            env=self.env,
        )
        self.prisma_database_url = explicit_prisma_database_url or self.prisma_database_url
        return self

    @property
    def database_url(self) -> str:
        return self.runtime_database_url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


def get_cors_allowed_origins(settings: Settings) -> list[str]:
    """Return a normalized list of configured CORS origins."""

    values = [origin.strip() for origin in settings.cors_allowed_origins_raw.split(",")]
    return cast(list[str], [origin for origin in values if origin])
