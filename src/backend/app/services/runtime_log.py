"""Persist runtime log events for Admin log visibility."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache
from uuid import uuid4

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config.settings import get_settings


SUPPORTED_LEVELS = {"info", "warn", "error"}
MAX_PREVIEW_LENGTH = 4000
logger = structlog.get_logger(__name__)


def _normalize_level(level: str | None) -> str:
    candidate = (level or "info").strip().lower()
    return candidate if candidate in SUPPORTED_LEVELS else "info"


def _normalize_text(value: str | None, fallback: str, max_length: int) -> str:
    candidate = (value or "").strip()
    if not candidate:
        candidate = fallback
    return candidate[:max_length]


def _truncate(value):
    if isinstance(value, str) and len(value) > MAX_PREVIEW_LENGTH:
        return f"{value[:MAX_PREVIEW_LENGTH]}..."
    return value


def _to_json_safe(value):
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return _truncate(value)
    if isinstance(value, dict):
        return {str(key): _to_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_json_safe(item) for item in value]
    if hasattr(value, "model_dump"):
        return _to_json_safe(value.model_dump())
    if hasattr(value, "dict"):
        return _to_json_safe(value.dict())
    return _truncate(str(value))


def _to_full_json_safe(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {str(key): _to_full_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_full_json_safe(item) for item in value]
    if hasattr(value, "model_dump"):
        return _to_full_json_safe(value.model_dump(mode="json"))
    if hasattr(value, "dict"):
        return _to_full_json_safe(value.dict())
    return str(value)


@lru_cache(maxsize=1)
def _get_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        future=True,
        pool_pre_ping=True,
    )


async def persist_runtime_log(
    *,
    level: str = "info",
    scope: str = "agentic-layer",
    event: str,
    message: str,
    context: dict | None = None,
    full_context: bool = False,
) -> None:
    engine = _get_engine()
    safe_context = _to_full_json_safe(context or {}) if full_context else _to_json_safe(context or {})
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS log_entries (
                      id UUID PRIMARY KEY,
                      level VARCHAR(20) NOT NULL,
                      scope VARCHAR(120) NOT NULL,
                      event VARCHAR(120) NOT NULL,
                      message TEXT NOT NULL,
                      context JSONB,
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS idx_log_entries_created_at ON log_entries (created_at DESC)")
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_log_entries_level_created_at ON log_entries (level, created_at DESC)"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_log_entries_scope_created_at ON log_entries (scope, created_at DESC)"
                )
            )
            await conn.execute(
                text(
                    """
                    INSERT INTO log_entries (id, level, scope, event, message, context, created_at)
                    VALUES (:id, :level, :scope, :event, :message, CAST(:context AS JSONB), :created_at)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "level": _normalize_level(level),
                    "scope": _normalize_text(scope, "agentic-layer", 120),
                    "event": _normalize_text(event, "runtime_log", 120),
                    "message": (message or event or "runtime_log")[:10_000],
                    "context": json.dumps(safe_context),
                    "created_at": datetime.now(timezone.utc),
                },
            )
    except Exception:
        logger.exception(
            "runtime_log.persist_failed",
            level=_normalize_level(level),
            scope=_normalize_text(scope, "agentic-layer", 120),
            event=_normalize_text(event, "runtime_log", 120),
            message_preview=(message or event or "runtime_log")[:500],
            context_preview=safe_context,
            full_context=full_context,
        )
        return None


async def persist_run_audit_log(
    *,
    event_type: str,
    run_id: str | None = None,
    session_id: str | None = None,
    actor: str = "system",
    payload: dict | None = None,
    message: str | None = None,
) -> None:
    engine = _get_engine()
    safe_payload = _to_full_json_safe(payload or {})
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    INSERT INTO audit_logs (id, run_id, session_id, event_type, actor, payload, message, created_at, updated_at)
                    VALUES (:id, :run_id, :session_id, :event_type, :actor, CAST(:payload AS JSONB), :message, :created_at, :updated_at)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "run_id": run_id,
                    "session_id": session_id,
                    "event_type": _normalize_text(event_type, "runtime.audit", 100),
                    "actor": _normalize_text(actor, "system", 255),
                    "payload": json.dumps(safe_payload),
                    "message": (message[:10_000] if isinstance(message, str) else None),
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
    except Exception:
        logger.exception(
            "runtime_audit.persist_failed",
            event_type=_normalize_text(event_type, "runtime.audit", 100),
            run_id=run_id,
            session_id=session_id,
        )
        return None
