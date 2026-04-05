"""Run lifecycle routes."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_settings
from app.config.settings import Settings
from app.models.enums import ApprovalStatus, RunStatus
from app.models.run import AgentRun
from app.models.session import Session
from app.repositories.approval_repository import ApprovalRepository
from app.repositories.run_repository import RunRepository
from app.repositories.session_repository import SessionRepository
from app.schemas.agent import ArtifactPayload
from app.schemas.common import StatusResponse
from app.schemas.run import (
    ResumeRunRequest,
    RunHistoryEntry,
    RunHistoryResponse,
    RunStatusResponse,
    RunSummaryResponse,
    StartRunRequest,
)
from app.workers.tasks import execute_new_run


router = APIRouter()


def _to_status_response(run: AgentRun) -> RunStatusResponse:
    return RunStatusResponse.model_validate(run)


@router.post("", response_model=RunStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_run(
    payload: StartRunRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> RunStatusResponse:
    """Create a session/run and start orchestration in the background."""

    session_repository = SessionRepository(db)
    run_repository = RunRepository(db)

    session = None
    if payload.session and payload.session.id:
        session = await session_repository.get_session(payload.session.id)

    if session is None:
        session = Session(
            id=payload.session.id if payload.session else None,
            title=payload.session.title if payload.session and payload.session.title else "Founder Session",
            objective=payload.session.objective if payload.session else None,
            founder_id=payload.session.founder_id if payload.session else None,
            tenant_id=payload.session.tenant_id if payload.session else None,
            metadata_json=payload.session.metadata if payload.session else {},
        )
        session = await session_repository.create_session(session)

    run = await run_repository.create_run(
        AgentRun(
            session_id=session.id,
            input_text=payload.input_text,
            request_type=payload.request_type,
            requested_agent=payload.requested_agent,
            state_snapshot={"context": payload.context},
            status=RunStatus.PENDING,
        )
    )
    await db.commit()

    background_tasks.add_task(
        execute_new_run,
        request.app.state.database.session_factory,
        request.app.state.registry_database.session_factory,
        settings,
        {
            "run_id": run.id,
            "session_id": session.id,
            "input_text": payload.input_text,
            "request_type": payload.request_type,
            "requested_agent": payload.requested_agent,
            "working_memory": payload.context,
        },
    )
    return _to_status_response(run)


@router.post("/{run_id}/resume", response_model=RunStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def resume_run(
    run_id: str,
    payload: ResumeRunRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> RunStatusResponse:
    """Resume a paused run after a checkpoint and approval decision."""

    run_repository = RunRepository(db)
    approval_repository = ApprovalRepository(db)
    run = await run_repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    if run.status != RunStatus.WAITING_FOR_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Run is not currently waiting for approval.",
        )

    checkpoint_ref = payload.checkpoint_ref or run.checkpoint_ref
    if not checkpoint_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No checkpoint reference is available for this run.",
        )

    pending_approvals = await approval_repository.get_pending_by_run(run_id)
    if pending_approvals:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending approval decision must be resolved before resuming.",
        )
    if not any(approval.status == ApprovalStatus.APPROVED for approval in run.approvals):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An approved decision is required before resume.",
        )

    run.status = RunStatus.RUNNING
    await db.commit()

    background_tasks.add_task(
        execute_new_run,
        request.app.state.database.session_factory,
        request.app.state.registry_database.session_factory,
        settings,
        {},
        checkpoint_ref=checkpoint_ref,
        context_updates=payload.context_updates,
    )
    return _to_status_response(run)


@router.get("/{run_id}", response_model=RunStatusResponse)
async def get_run_status(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> RunStatusResponse:
    """Fetch current run status."""

    run = await RunRepository(db).get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return _to_status_response(run)


@router.get("/{run_id}/summary", response_model=RunSummaryResponse)
async def get_run_summary(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> RunSummaryResponse:
    """Fetch a run summary with artifacts and history."""

    repository = RunRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    history = await repository.get_history(run_id)
    return RunSummaryResponse(
        **RunStatusResponse.model_validate(run).model_dump(),
        approvals=[approval for approval in run.approvals],
        artifacts=[
            ArtifactPayload(
                title=artifact.title,
                kind=artifact.kind,
                summary=artifact.summary,
                sections=artifact.content_json.get("artifact", {}).get("sections", []),
                metadata=artifact.content_json.get("artifact", {}).get("metadata", {}),
            )
            for artifact in run.artifacts
        ],
        history=[
            RunHistoryEntry.model_validate(entry).model_dump()
            for entry in history
        ],
    )


@router.get("/{run_id}/history", response_model=RunHistoryResponse)
async def get_run_history(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> RunHistoryResponse:
    """Fetch audit history for a run."""

    repository = RunRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    history = await repository.get_history(run_id)
    return RunHistoryResponse(
        run_id=run_id,
        entries=[RunHistoryEntry.model_validate(entry) for entry in history],
    )


@router.post("/{run_id}/cancel", response_model=StatusResponse)
async def cancel_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> StatusResponse:
    """Cancel a run if it has not already completed."""

    repository = RunRepository(db)
    run = await repository.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    if run.status in {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run is already {run.status.value}.",
        )

    run.status = RunStatus.CANCELLED
    await db.commit()
    return StatusResponse(status="cancelled", detail="Run marked as cancelled.")


@router.get("/{run_id}/events")
async def run_events_placeholder(run_id: str) -> StatusResponse:
    """Placeholder endpoint reserved for SSE progress streaming."""

    return StatusResponse(
        status="not_implemented",
        detail=f"SSE progress streaming is not wired yet for run '{run_id}', but the route is reserved.",
    )
