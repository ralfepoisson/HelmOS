"""Persistence helpers for agent test runs."""

from sqlalchemy import select

from app.models.agent_test import (
    AgentTestAnnotation,
    AgentTestRun,
    AgentTestRunSnapshot,
    AgentTestScore,
    AgentTestTurn,
)
from app.repositories.base import SQLAlchemyRepository


class AgentTestRepository(SQLAlchemyRepository):
    """CRUD helpers for agent test records."""

    async def create_run(self, run: AgentTestRun) -> AgentTestRun:
        return await self.add(run)

    async def add_snapshot(self, snapshot: AgentTestRunSnapshot) -> AgentTestRunSnapshot:
        return await self.add(snapshot)

    async def add_turn(self, turn: AgentTestTurn) -> AgentTestTurn:
        return await self.add(turn)

    async def add_annotation(self, annotation: AgentTestAnnotation) -> AgentTestAnnotation:
        return await self.add(annotation)

    async def add_score(self, score: AgentTestScore) -> AgentTestScore:
        return await self.add(score)

    async def get_run(self, run_id: str) -> AgentTestRun | None:
        return await self.get_by_id(AgentTestRun, run_id)

    async def list_runs(self) -> list[AgentTestRun]:
        result = await self.session.execute(
            select(AgentTestRun).order_by(AgentTestRun.created_at.desc())
        )
        return list(result.scalars().all())
