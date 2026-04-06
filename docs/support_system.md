# Integrated Support System

## Overview

HelmOS now includes a first end-to-end support capability that spans:

- a global authenticated help widget in the Angular application
- bounded client-side telemetry capture for bug reports
- backend support conversations and ticket lifecycle storage
- advisory-only incident investigation with human review controls
- a reusable log-analysis service and internal tool endpoint
- a dedicated knowledge-base partition for user/platform help content
- an admin support dashboard for interactions, tickets, investigations, and approvals

The implementation is intentionally scoped as a vertical slice rather than a full ITSM platform.
It is designed to fit the current Node control plane, Prisma data model, Angular standalone UI,
and database-backed agent registry already used elsewhere in HelmOS.

## Key Safety Rules

- Agents do not deploy fixes.
- Agents do not mutate production data automatically.
- Every proposed remediation remains advisory-only.
- Human admins explicitly approve, reject, or edit recommendations in the admin dashboard.
- Client telemetry is bounded, filtered, and re-sanitised server-side.
- Secrets, cookies, tokens, and similar sensitive fields are redacted.

## Main Components

### Frontend

- `HelpWidgetComponent`
  Persistent floating support entrypoint mounted at the app root.
- `SupportSessionService`
  Session-scoped widget state, persistence, and chat orchestration.
- `SupportTelemetryService`
  Captures a bounded window of console errors, uncaught exceptions, promise rejections,
  failed fetch/XHR calls, viewport metadata, and recent UI events.
- `SupportAdminScreenComponent`
  Admin dashboard for Help Desk interactions, tickets, investigations, and review actions.

### Backend

- `support-router.js`
  Authenticated user endpoints for loading the current conversation and sending support messages.
- `support.service.js`
  Help Desk orchestration: question answering via KB search, bug detection, ticket creation,
  telemetry attachment, and response shaping.
- `support-investigation.service.js`
  Incident Response orchestration: evidence review, log analysis, issue classification,
  remediation recommendation, and review-state updates.
- `support-admin.service.js`
  Admin read/update/review workflows for conversations and tickets.
- `support-log-analysis.service.js`
  Reusable log-analysis abstraction with a Prisma-backed provider and structured output.
- `support-bootstrap.service.js`
  Ensures the support KB partition and agent registry scaffolding exist on startup.

## Data Flow

1. A signed-in user opens the help widget.
2. The widget restores session state from `sessionStorage` and requests the current open conversation.
3. When the user sends a message:
   - the frontend captures bounded client context
   - the backend stores the user message
   - the Help Desk service detects whether this is a usage question or likely issue report
4. For usage questions:
   - the backend searches only the `Platform Help / User Documentation` knowledge base
   - the assistant replies with verified documentation-backed guidance or states that it could not verify an answer
5. For likely bugs/incidents:
   - the backend creates a support ticket
   - telemetry and user narrative are attached
   - the log-analysis service optionally checks for related backend signals
   - the user receives the ticket reference and current status
6. Admins review tickets in `/admin/support`.
7. Admins can trigger an Incident Response investigation.
8. The investigation stores structured notes and a proposed remediation.
9. A human approves, rejects, or edits the recommendation before any later engineering action.

## Knowledge Base Partition

The support slice uses a dedicated partition:

- `Platform Help / User Documentation`

Bootstrapping logic will create this knowledge base automatically when:

- the support migration has been applied
- at least one local admin user exists
- the KB does not already exist

Recommended content for this partition:

- user guides
- onboarding docs
- workflow walkthroughs
- FAQ material
- support-ready troubleshooting guides

The Help Desk service intentionally searches only this partition by default.

## Log Analysis Tool

The reusable log-analysis service supports:

- natural-language investigation input
- explicit filters for severity, request ID, user ID, tenant ID, route, and time range
- repeated-error grouping by normalized fingerprint
- first seen / last seen timestamps
- bounded raw excerpts
- a short incident summary suitable for agent or admin reasoning

The current provider reads from HelmOS `log_entries` through Prisma and filters JSON context in-process.
Later providers can swap in external observability backends without changing the support API contract.

Internal tool endpoint:

- `POST /api/tools/log-analysis/analyze`

Python agent runtime adapter:

- `log_analysis`

## Human Review Workflow

Ticket statuses introduced for support:

- `NEW`
- `TRIAGED`
- `INVESTIGATING`
- `WAITING_FOR_HUMAN_REVIEW`
- `ACTION_APPROVED`
- `ACTION_REJECTED`
- `RESOLVED`
- `CLOSED`

The recommendation review endpoint records both:

- ticket state changes
- recommendation review metadata

This keeps auditability separate from later execution by an engineering agent or human operator.

## Local Development

### Apply the database change

```bash
npx prisma migrate dev
```

### Run the backend

```bash
npm run backend:dev
```

### Run the frontend

```bash
cd src/webapp
npm start
```

### Run targeted support tests

Backend:

```bash
node --test \
  src/backend/tests/support-telemetry.service.test.js \
  src/backend/tests/support-log-analysis.service.test.js \
  src/backend/tests/support.service.test.js
```

Frontend:

```bash
cd src/webapp
npx ng test --watch=false \
  --include src/app/features/support/support-api.service.spec.ts \
  --include src/app/app.spec.ts
```

## Current Limitations

- Help Desk responses are deterministic and KB-backed; they do not yet call a richer model-runtime flow for user chat.
- Incident investigation currently focuses on logs plus attached context; no secure read-only application DB probing is wired yet.
- The Help Desk and Incident Response agents are scaffolded in the registry for future runtime execution, but the first production slice uses the Node support services directly.
- Browser telemetry capture is bounded and lightweight; it is not a replacement for full frontend observability tooling.
- The default KB partition is created automatically, but content seeding is still a manual admin task.

## Recommended Next Steps

- add richer KB citation rendering in the widget
- support secure read-only domain queries inside incident investigations
- expose conversation/ticket filters in the admin dashboard UI
- stream investigation progress instead of polling/reloading
- connect the support agents to the Python orchestration runtime for more advanced multi-step reasoning
