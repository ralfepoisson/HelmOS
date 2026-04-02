"""Persistence helpers for agent test runs."""

from sqlalchemy import delete, select

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

    async def list_runs_for_agent(self, target_agent_key: str) -> list[AgentTestRun]:
        result = await self.session.execute(
            select(AgentTestRun)
            .where(AgentTestRun.target_agent_key == target_agent_key)
            .order_by(AgentTestRun.updated_at.desc(), AgentTestRun.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_runs(self) -> list[AgentTestRun]:
        result = await self.session.execute(
            select(AgentTestRun).order_by(AgentTestRun.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_snapshots_for_run(self, run_id: str) -> list[AgentTestRunSnapshot]:
        result = await self.session.execute(
            select(AgentTestRunSnapshot)
            .where(AgentTestRunSnapshot.test_run_id == run_id)
            .order_by(AgentTestRunSnapshot.created_at.asc())
        )
        return list(result.scalars().all())

    async def clear_execution_artifacts(self, run_id: str) -> None:
        await self.session.execute(
            delete(AgentTestAnnotation).where(AgentTestAnnotation.test_run_id == run_id)
        )
        await self.session.execute(
            delete(AgentTestScore).where(AgentTestScore.test_run_id == run_id)
        )
        await self.session.execute(
            delete(AgentTestTurn).where(AgentTestTurn.test_run_id == run_id)
        )

    async def delete_run(self, run_id: str) -> None:
        await self.clear_execution_artifacts(run_id)
        await self.session.execute(
            delete(AgentTestRunSnapshot).where(AgentTestRunSnapshot.test_run_id == run_id)
        )
        await self.session.execute(delete(AgentTestRun).where(AgentTestRun.id == run_id))
