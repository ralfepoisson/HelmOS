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
  scripts/            local backend utilities
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

   The gateway is intended to serve `http://127.0.0.1:8000` in local development.
   The Angular webapp dev server proxies `/api/v1` traffic to this process.
   In local development the FastAPI runtime still uses
   `HELMOS_DATABASE_URL` for orchestration persistence tables such as sessions,
   runs, checkpoints, and audit history.
   The specialist agent registry is resolved separately and prefers the repo-root
   Prisma `DATABASE_URL` when it is present, so the FastAPI runtime and Node
   control plane share agent definitions and prompt configs without forcing both
   services onto the same run-storage schema.
   When you start the gateway via
   [scripts/start_agent_gateway.sh](/Users/ralfe/Dev/HelmOS/scripts/start_agent_gateway.sh),
   that shared root env is still loaded explicitly.

4. Create agents through the Agent Admin screen or Node control-plane API.

   The FastAPI gateway now treats `agent_definitions` plus active
   `prompt_configs` as the source of truth for runnable agents.

5. Start the LiteLLM proxy container if you want live model calls:

   ```bash
   cp .env.litellm.example .env.litellm
   docker compose -f docker-compose.litellm.yml up -d
   ```

## Frontend integration

During local product development, the Angular app uses
[src/webapp/proxy.conf.json](/Users/ralfe/Dev/HelmOS/src/webapp/proxy.conf.json)
to forward:

- `/api` to the Node control-plane backend on `127.0.0.1:3001`
- `/api/v1` to the FastAPI Agent Gateway on `127.0.0.1:8000`

That proxy path is now the preferred local route for ideation agent runs.
The frontend still keeps a direct `localhost:8000` fallback for resilience,
but a healthy local stack should go through the Angular proxy first.

## Notes

- PostgreSQL is the intended system of record.
- `pgvector` is supported for retrieval, but structured business truth remains relational.
- The orchestration layer is wired for LangGraph and human approval checkpoints.
- The agentic layer talks to an OpenAI-compatible LiteLLM proxy via `HELMOS_LITELLM_PROXY_URL`; upstream provider keys should stay in the proxy container env, not in backend application code.
- Runtime agents are loaded dynamically from `agent_definitions` and active `prompt_configs`; adding a new agent should not require new Python classes.
- Agent Admin prompt fields are composed into a rich runtime system prompt. The active runtime uses either `config_json.system_prompt` directly or a synthesized prompt built from purpose, scope notes, prompt sections, execution settings, and tool permissions.
- The product control plane can inspect runtime agent registration through `GET /api/v1/admin/agents`.
- Prospecting Configuration runs now perform a gateway-registry preflight check before starting a review, so local registry drift is surfaced as a clear operator error instead of silently falling back to deterministic routing.
- The Node control plane now starts a prospecting runtime that polls every minute and runs due prospecting configurations on an enforced hourly schedule, with each cycle executing Prospecting Agent review followed immediately by Prospecting Execution.
- Prospecting review persistence now writes the enforced hourly cadence back into the saved UI snapshot, and Prospecting Execution retries zero-result quoted boolean queries once with a simplified query before storing an empty result set.
- Background prospecting runtime tick failures are now emitted to stderr instead of being swallowed, so database or infrastructure outages remain observable between automation runs.
- The gateway uses separate runtime and registry database connections in local development: runtime writes stay on `HELMOS_DATABASE_URL`, while registry reads can point at the shared Prisma `DATABASE_URL`.
- Alembic is declared as a dependency and the model layout is migration-friendly, but migrations are not generated in this first pass.
