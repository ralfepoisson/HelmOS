from app.config.settings import Settings
from app.config.settings import (
    DEFAULT_ENV_FILES,
    DEFAULT_DATABASE_URL,
    normalize_database_url,
    resolve_database_url,
    resolve_registry_database_url,
)


def test_normalize_database_url_converts_prisma_schema_url():
    normalized = normalize_database_url("postgresql://postgres@localhost:5432/postgres?schema=helmos")

    assert normalized == "postgresql+psycopg://postgres@localhost:5432/postgres?options=-csearch_path%3Dhelmos"


def test_normalize_database_url_preserves_existing_sqlalchemy_url():
    normalized = normalize_database_url(
        "postgresql+psycopg://postgres:postgres@localhost:5432/helmos"
    )

    assert normalized == "postgresql+psycopg://postgres:postgres@localhost:5432/helmos"


def test_resolve_database_url_falls_back_to_prisma_database_url():
    resolved = resolve_database_url(
        DEFAULT_DATABASE_URL,
        "postgresql://postgres@localhost:5432/postgres?schema=helmos",
    )

    assert resolved == "postgresql+psycopg://postgres@localhost:5432/postgres?options=-csearch_path%3Dhelmos"


def test_default_env_files_load_backend_then_repo_root_env():
    assert DEFAULT_ENV_FILES[0].endswith("/src/backend/.env")
    assert DEFAULT_ENV_FILES[1].endswith("/.env")


def test_resolve_registry_database_url_prefers_prisma_database_url_in_local_mode():
    resolved = resolve_registry_database_url(
        None,
        "postgresql+psycopg://postgres:postgres@localhost:5432/helmos",
        "postgresql://postgres@localhost:5432/postgres?schema=helmos",
        env="local",
    )

    assert resolved == "postgresql+psycopg://postgres@localhost:5432/postgres?options=-csearch_path%3Dhelmos"


def test_resolve_registry_database_url_falls_back_to_runtime_database_outside_local():
    resolved = resolve_registry_database_url(
        None,
        "postgresql+psycopg://postgres:postgres@localhost:5432/helmos",
        "postgresql://postgres@localhost:5432/postgres?schema=helmos",
        env="production",
    )

    assert resolved == "postgresql+psycopg://postgres:postgres@localhost:5432/helmos"


def test_settings_keep_runtime_and_prisma_database_urls_separate(monkeypatch):
    monkeypatch.setenv("HELMOS_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/helmos")
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres@localhost:5432/postgres?schema=helmos")
    monkeypatch.setenv("HELMOS_ENV", "local")

    settings = Settings(_env_file=())

    assert settings.database_url == "postgresql+psycopg://postgres:postgres@localhost:5432/helmos"
    assert settings.registry_database_url == "postgresql+psycopg://postgres@localhost:5432/postgres?options=-csearch_path%3Dhelmos"
    assert settings.prisma_database_url == "postgresql://postgres@localhost:5432/postgres?schema=helmos"
