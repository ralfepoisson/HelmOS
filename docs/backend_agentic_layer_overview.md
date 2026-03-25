# Backend Agentic Layer Overview

## Intent

The HelmOS backend agentic layer is implemented as a supervised orchestration platform, not as an uncontrolled multi-agent swarm.

The design centres on:

- an Agent Gateway API for durable run lifecycle control
- a shared registry for agent definitions and prompt configuration
- an admin-facing runtime snapshot endpoint for control-plane visibility
- a LangGraph-oriented supervisor and planner workflow
- generic specialist agent runtime loaded from database registration records
- deterministic services for structure, scoring, rendering, and export
- strict tool registry boundaries
- auditable approval checkpoints
- persistent state, trace references, and structured operational logs

## Main Flow

1. A founder request enters the FastAPI Agent Gateway.
2. A `Session` and `AgentRun` are created or resumed.
3. The orchestration runtime loads explicit memory surfaces:
   - working memory from run state
   - session context
   - structured domain context
   - retrieval support
4. The LangGraph workflow runs:
   - `supervisor`
   - `planner`
   - deterministic path, specialist path, or multi-step workflow path
   - `policy`
   - `approval` or `finalize`
5. Outputs are normalized and stored as `Artifact` records.
6. Audit events, checkpoint references, and trace references are persisted for observability and resumption.

## Key Boundaries

### API

The API exposes durable run operations without leaking internal orchestration details to the frontend.

It now also exposes a lightweight admin surface for runtime inspection:

- `GET /api/v1/admin/agents`

This route returns the currently registered specialist agent descriptors
so the product control plane can compare persisted registry state with
the live runtime.

On the Node control-plane side, the admin surface can now create and
update persisted agent definitions together with their active prompt
configurations, so a founder can register the first ideation specialist
without writing SQL directly.

### Orchestration

The orchestration runtime owns control flow, pause/resume behavior, policy checks, and specialist delegation.

### Agents

Specialist agents are intentionally narrow:

- each runnable agent is defined through `agent_definitions`
- behavior and prompt configuration come from active `prompt_configs`
- the Python gateway materializes a generic runtime agent from those records

Each agent exposes:

- a version
- a purpose
- typed input/output contracts
- explicit allowed tools

### Deterministic Services

These services are used wherever reliable code is better than free-form reasoning:

- template rendering
- output normalization
- rules and scoring
- export abstraction
- policy evaluation
- model routing
- LiteLLM-backed LLM gateway

### Tools

Agents only reach infrastructure through the `ToolRegistry`. Placeholder adapters are included for:

- web search
- retrieval
- object storage
- email/calendar communications

### Data and Memory

Relational storage remains the source of truth for business state. Retrieval embeddings are additive and isolated from structured domain context.

For agent administration, the shared relational layer now also contains:

- `agent_definitions`
- `prompt_configs`

These tables are managed from the Node control-plane backend and read by
the FastAPI gateway at runtime.

## Persistence Model

The initial SQLAlchemy model layer includes:

- `Session`
- `AgentRun`
- `AgentCheckpoint`
- `ApprovalRequest`
- `AgentDefinition`
- `PromptConfig`
- `AuditLog`
- `Artifact`
- `DomainContext`
- `RetrievalDocument`

## Observability

The first pass includes:

- structured logging with `structlog`
- audit event persistence
- LangSmith tracing hooks
- OpenTelemetry-ready instrumentation shims
- placeholders for evaluation datasets and release controls

## LLM Gateway

The backend now treats LiteLLM proxy as the single LLM ingress point.

- the agentic layer requests logical model aliases such as `helmos-default` and `helmos-supervisor`
- LiteLLM maps those aliases to upstream provider models
- provider credentials live in the LiteLLM container environment instead of the backend process
- this keeps rotation, fallback, and future routing policy centralized

## Current Limits

- Live provider integrations are still placeholders where credentials are required.
- Alembic is not generated yet, though the model layout is migration-friendly.
- SSE progress streaming is reserved in the API but not fully wired.
- Prompt activation is key-based rather than foreign-key based today, so
  agent/prompt linkage depends on naming conventions such as
  `ideation.default`.
