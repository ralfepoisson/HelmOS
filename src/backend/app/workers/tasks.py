"""Background task entrypoints."""

import structlog

from app.api.deps import build_runtime
from app.models.enums import RunStatus
from app.repositories.run_repository import RunRepository


logger = structlog.get_logger(__name__)


async def execute_new_run(
    session_factory,
    settings,
    initial_state: dict,
    *,
    checkpoint_ref: str | None = None,
    context_updates: dict | None = None,
) -> None:
    """Execute a new or resumed run in a background task."""

    async with session_factory() as session:
        runtime = build_runtime(session=session, settings=settings)
        run_repository = RunRepository(session)

        try:
            if checkpoint_ref:
                checkpoint = await run_repository.get_checkpoint_by_ref(checkpoint_ref)
                if checkpoint is None:
                    raise LookupError(f"Checkpoint '{checkpoint_ref}' not found.")
                state = await runtime.resume_after_approval(
                    checkpoint_ref,
                    context_updates=context_updates,
                )
                run_record = await run_repository.get_run(state["run_id"])
            else:
                run_record = await run_repository.get_run(initial_state["run_id"])
                await run_repository.update_status(run_record, RunStatus.RUNNING)
                state = await runtime.execute(initial_state)

            logger.info(
                "run.execution.finished",
                run_id=run_record.id,
                status=run_record.status.value,
            )
            await session.commit()
        except Exception as exc:  # pragma: no cover - defensive operational path
            logger.exception("run.execution.failed", error=str(exc))
            run_id = initial_state.get("run_id")
            if checkpoint_ref and not run_id:
                checkpoint = await run_repository.get_checkpoint_by_ref(checkpoint_ref)
                run_id = checkpoint.run_id if checkpoint else None
            if run_id:
                run_record = await run_repository.get_run(run_id)
                if run_record:
                    await run_repository.update_status(
                        run_record,
                        RunStatus.FAILED,
                        error_message=str(exc),
                    )
            await session.commit()
