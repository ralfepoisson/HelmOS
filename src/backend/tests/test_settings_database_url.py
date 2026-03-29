from app.config.settings import (
    DEFAULT_DATABASE_URL,
    normalize_database_url,
    resolve_database_url,
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
