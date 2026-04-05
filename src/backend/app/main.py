"""FastAPI application entrypoint."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.api_router import api_router
from app.config.logging import configure_logging
from app.config.settings import get_cors_allowed_origins, get_settings
from app.repositories.database import DatabaseManager
from app.workers.agent_test_tasks import run_agent_test_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    database = DatabaseManager(settings)
    registry_database = (
        database
        if settings.registry_database_url == settings.database_url
        else DatabaseManager(settings, database_url_override=settings.registry_database_url)
    )
    app.state.settings = settings
    app.state.database = database
    app.state.registry_database = registry_database
    app.state.agent_test_control_events = {}
    await database.initialize()
    agent_test_worker_stop = asyncio.Event()
    agent_test_worker_task = None
    if settings.agent_test_worker_enabled:
        agent_test_worker_task = asyncio.create_task(
            run_agent_test_worker(
                database.session_factory,
                settings,
                agent_test_worker_stop,
                app.state.agent_test_control_events,
            )
        )
    try:
        yield
    finally:
        if agent_test_worker_task is not None:
            agent_test_worker_stop.set()
            agent_test_worker_task.cancel()
            try:
                await agent_test_worker_task
            except asyncio.CancelledError:
                pass
        if registry_database is not database:
            await registry_database.dispose()
        await database.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="HelmOS Agent Gateway",
        version="0.1.0",
        description="Supervisor-oriented agent gateway for HelmOS.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_allowed_origins(settings),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
