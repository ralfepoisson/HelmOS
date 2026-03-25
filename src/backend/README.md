# HelmOS Backend

This package contains the first production-oriented implementation of the HelmOS agentic layer.

## What is included

- FastAPI gateway API for run lifecycle management
- admin runtime snapshot route for registry-aware control-plane UIs
- SQLAlchemy persistence models and repositories
- LangGraph-oriented orchestration scaffolding with approval checkpoints
- generic database-backed specialist agent runtime driven by Agent Admin registrations
- deterministic service layer for normalisation, templating, scoring, and export
- LiteLLM-backed LLM gateway abstraction so the backend talks to one proxy instead of provider SDKs
- controlled tool registry with placeholder adapters
- AgentOps foundations for auditability, tracing, and future release controls

## Structure

```text
src/backend/
  app/
    api/              FastAPI routes and dependencies
    agents/           specialist agents and registry
    config/           settings and logging setup
    memory/           run, session, domain, and retrieval access
    models/           ORM entities and shared database types
    ops/              tracing, audit, telemetry helpers
    orchestration/    workflow graph and runtime orchestration
    repositories/     persistence access layer
    schemas/          Pydantic contracts
    services/         deterministic services
    tools/            registry and external service adapters
    workers/          async/background execution helpers
  fixtures/           sample seed payloads
  scripts/            local seed helpers
  tests/              backend tests
```

## Local setup

1. Create a virtualenv and install dependencies:

   ```bash
   cd src/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

2. Copy the example environment:

   ```bash
   cp .env.example .env
   ```

3. Start the API:

   ```bash
   uvicorn app.main:app --reload
   ```

4. Create agents through the Agent Admin screen or Node control-plane API.

   The FastAPI gateway now treats `agent_definitions` plus active
   `prompt_configs` as the source of truth for runnable agents.

5. Optional: seed sample registry data after your database is available:

   ```bash
   python scripts/seed_data.py
   ```

6. Start the LiteLLM proxy container if you want live model calls:

   ```bash
   cp .env.litellm.example .env.litellm
   docker compose -f docker-compose.litellm.yml up -d
   ```

## Notes

- PostgreSQL is the intended system of record.
- `pgvector` is supported for retrieval, but structured business truth remains relational.
- The orchestration layer is wired for LangGraph and human approval checkpoints.
- The agentic layer talks to an OpenAI-compatible LiteLLM proxy via `HELMOS_LITELLM_PROXY_URL`; upstream provider keys should stay in the proxy container env, not in backend application code.
- Runtime agents are loaded dynamically from `agent_definitions` and active `prompt_configs`; adding a new agent should not require new Python classes.
- The product control plane can inspect runtime agent registration through `GET /api/v1/admin/agents`.
- Alembic is declared as a dependency and the model layout is migration-friendly, but migrations are not generated in this first pass.
