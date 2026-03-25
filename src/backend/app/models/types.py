"""Shared SQLAlchemy types with graceful fallbacks."""

from sqlalchemy import JSON

try:
    from pgvector.sqlalchemy import Vector
except ImportError:  # pragma: no cover - fallback for environments without pgvector
    Vector = None


def vector_type(dimensions: int):
    """Return a pgvector column type when available, else JSON."""

    if Vector is None:
        return JSON
    return Vector(dimensions)
