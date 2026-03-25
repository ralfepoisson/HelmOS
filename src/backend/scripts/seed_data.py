"""Seed baseline agent registry and prompt configuration data."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.config.settings import get_settings
from app.models import AgentDefinition, PromptConfig
from app.repositories.database import DatabaseManager


FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "seed_data.json"


async def seed() -> None:
    settings = get_settings()
    database = DatabaseManager(settings)
    await database.initialize()

    with FIXTURE_PATH.open("r", encoding="utf-8") as fixture_file:
        payload = json.load(fixture_file)

    async with database.session_factory() as session:
        for item in payload.get("agent_definitions", []):
            existing = await session.execute(
                select(AgentDefinition).where(AgentDefinition.key == item["key"])
            )
            if existing.scalar_one_or_none() is None:
                session.add(AgentDefinition(**item))

        for item in payload.get("prompt_configs", []):
            existing = await session.execute(
                select(PromptConfig).where(
                    PromptConfig.key == item["key"],
                    PromptConfig.version == item["version"],
                )
            )
            if existing.scalar_one_or_none() is None:
                session.add(PromptConfig(**item))

        await session.commit()

    await database.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
