# Backend API

The HelmOS backend is a lightweight Node.js + Express service backed by
Prisma and PostgreSQL.

It exposes a REST API for the current ERD-defined MVP entities and is
designed to be stateless so it can later run cleanly in AWS ECS behind a
load balancer.

## Local development

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm run backend:start
```

Run in watch mode:

```bash
npm run backend:dev
```

Run backend tests:

```bash
npm run test:backend
```

The backend expects `DATABASE_URL` to be set. The repository already
includes an example in [.env.example](/Users/ralfe/Dev/HelmOS/.env.example).

If you want the Admin UI to read live runtime registration state from the
Python agent gateway, also set:

- `AGENT_GATEWAY_BASE_URL`
  Example: `http://localhost:8000/api/v1`

Default local bind:

- Host: `0.0.0.0`
- Port: `3001`

## API conventions

Base path: `/api`

Infrastructure endpoints:

- `GET /api/health`
- `GET /api/meta`
- `GET /api/business-ideas`
- `POST /api/business-ideas`
- `GET /api/business-ideas/:workspaceId`
- `GET /api/business-ideas/:workspaceId/value-proposition`
- `POST /api/business-ideas/:workspaceId/ideation/messages`
- `POST /api/business-ideas/:workspaceId/ideation/messages/retry-last`
- `POST /api/business-ideas/:workspaceId/value-proposition/messages`
- `POST /api/business-ideas/:workspaceId/value-proposition/messages/retry-last`
- `GET /api/admin/agents`
- `POST /api/admin/agents`
- `PATCH /api/admin/agents/:id`

CRUD pattern for each resource:

- `GET /api/<resource>`
- `POST /api/<resource>`
- `GET /api/<resource>/:id`
- `PATCH /api/<resource>/:id`
- `DELETE /api/<resource>/:id`

Supported resources:

- `users`
- `organisations`
- `organisation-members`
- `companies`
- `workspaces`
- `strategy-documents`
- `strategy-sections`
- `section-versions`
- `document-insights`
- `stage-progress`
- `chat-threads`
- `chat-messages`
- `agent-runs`
- `agent-run-effects`
- `activity-log`
- `agent-definitions`
- `prompt-configs`

List endpoints support exact-match filters through query parameters on
key fields. Use `GET /api/meta` to inspect the filterable fields and enum
values exposed by the server.

## Agent Admin flow

The Agent Admin screen in the Angular app uses the Node backend as its
single control-plane API.

`GET /api/admin/agents` returns:

- persisted `agent_definitions`
- the latest active `prompt_configs` grouped by agent key
- a runtime snapshot from the FastAPI agent gateway when
  `AGENT_GATEWAY_BASE_URL` is configured

`POST /api/admin/agents` creates:

- a new `agent_definition`
- the first active `prompt_config` for that agent
  The prompt key defaults to `<agent-key>.default` when omitted.
- `defaultModel` must use a supported model alias such as
  `helmos-default`, `helmos-research`, or `helmos-supervisor`
- `allowedTools` must use supported tool names such as `retrieval`,
  `web_search`, `object_storage`, or `communications`

`PATCH /api/admin/agents/:id` updates:

- the selected agent definition
- the active prompt config for that agent
  A new prompt version can be created in the same request.

The FastAPI gateway materializes runnable agents directly from these
database records. New agents should be registered through Agent Admin,
not by adding new Python classes.

`promptConfig.configJson` is intentionally flexible. The generic runtime
currently understands keys such as:

- `system_prompt`
- `temperature`
- `artifact_kind`
- `artifact_title`
- `artifact_summary`
- `output_sections`
- `next_actions`

The Node backend talks to the agent gateway over HTTP using:

- `GET <AGENT_GATEWAY_BASE_URL>/admin/agents`

## Example requests

Create a workspace:

```bash
curl -X POST http://localhost:3001/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "11111111-1111-1111-1111-111111111111",
    "name": "Acme Ideation Workspace",
    "workspaceType": "IDEATION",
    "status": "ACTIVE",
    "currentStage": "IDEATION",
    "createdByUserId": "22222222-2222-2222-2222-222222222222"
  }'
```

List workspace stages:

```bash
curl "http://localhost:3001/api/stage-progress?workspaceId=33333333-3333-3333-3333-333333333333"
```

Create a chat message without supplying `messageIndex`:

```bash
curl -X POST http://localhost:3001/api/chat-messages \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "44444444-4444-4444-4444-444444444444",
    "senderType": "USER",
    "messageText": "Please refine the target customer section."
  }'
```

The backend will automatically assign the next `messageIndex` for that
thread. `section-versions` behave similarly for `versionNo`.

Create a new business idea and bootstrap its Strategy Copilot workspace:

```bash
curl -X POST http://localhost:3001/api/business-ideas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Orbit Forge Labs",
    "businessType": "RESEARCH_AND_DEVELOPMENT"
  }'
```

This workflow creates the company, workspace, ideation document, starter
sections, stage progression, initial chat thread, and an activity log
entry in one transaction.

Fetch the Agent Admin snapshot:

```bash
curl http://localhost:3001/api/admin/agents
```

Create a new agent and its initial prompt config:

```bash
curl -X POST http://localhost:3001/api/admin/agents \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ideation",
    "name": "Ideation Agent",
    "version": "1.0.0",
    "description": "Transforms founder input into structured idea briefs.",
    "allowedTools": ["retrieval"],
    "defaultModel": "helmos-default",
    "active": true,
    "promptConfig": {
      "version": "1.0.0",
      "promptTemplate": "Generate a founder-oriented idea brief from: {prompt}",
      "configJson": {
        "temperature": 0.2,
        "artifact_kind": "idea_brief"
      }
    }
  }'
```

Update an agent definition and promote a new prompt version:

```bash
curl -X PATCH http://localhost:3001/api/admin/agents/11111111-1111-1111-1111-111111111111 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ideation Agent",
    "version": "1.1.0",
    "description": "Refines founder concepts into structured idea briefs.",
    "allowedTools": ["retrieval", "web_search"],
    "defaultModel": "gpt-4.1",
    "active": true,
    "promptConfig": {
      "version": "1.1.0",
      "promptTemplate": "Refine the founder brief from: {prompt}",
      "configJson": {
        "temperature": 0.1,
        "artifact_kind": "idea_brief"
      }
    }
  }'
```

## Containerization

Build the backend image:

```bash
docker build -f Dockerfile.backend -t helmos-backend .
```

Run the container:

```bash
docker run --rm -p 3001:3001 \
  -e DATABASE_URL="postgresql://postgres@host.docker.internal:5432/postgres?schema=helmos" \
  helmos-backend
```

This image is suitable for ECS-style deployment because the service:

- is stateless
- reads configuration from environment variables
- exposes a simple health endpoint at `GET /api/health`
- handles `SIGINT` and `SIGTERM` for graceful shutdown
