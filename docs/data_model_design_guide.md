# HelmOS MVP Data Model Design Guide

## Purpose

This data model supports the current HelmOS MVP focused on the **Ideation** workspace. It is designed around the prototype you shared, where the application has three main UI concerns:

1. a **left navigation and progression model**
2. a **structured ideation workspace in the centre**
3. a **persistent collaboration chat with the HelmOS agent on the right**

The design deliberately treats HelmOS as a **stateful application with structured artefacts**, not merely a chat wrapper.

---

## Core modelling principle

The most important design decision is this:

**The structured ideation workspace is the source of truth.**

That means:

- `chat_messages` store the conversational history
- `strategy_sections` store the actual business concept content shown in the centre workspace
- `section_versions` preserve revision history for "View changes"
- `agent_runs` record how the agent processed a user message and what it changed

This separation prevents the system from becoming dependent on chat replay in order to rebuild the document state.

---

## Design goals

The schema is intended to support:

- multi-user ownership and collaboration
- multiple companies or ventures per account
- one or more workspaces per company over time
- structured ideation sections with editable content
- revision history for each section
- persistent chat with the agent
- progression and unlock logic for future strategy tools
- explainability and observability of agent updates

---

## Why PostgreSQL

PostgreSQL is the recommended database for this design because it provides:

- strong relational integrity
- flexible `JSONB` fields for agent metadata and scoring
- robust indexing and querying
- a clean growth path to full-text search and analytics
- good compatibility with AWS managed hosting

A pure document database would be a weaker fit because the prototype already has clear structure and business rules.

---

## Main domain areas

The schema is divided into five logical areas:

### 1. Identity and ownership
These tables define who owns and collaborates in the system.

- `users`
- `organisations`
- `organisation_members`

### 2. Business context
These tables represent the venture being designed and the workspace in which strategy work happens.

- `companies`
- `workspaces`

### 3. Structured strategy document
These tables hold the centre-panel business concept artefact.

- `strategy_documents`
- `strategy_sections`
- `section_versions`
- `document_insights`
- `stage_progress`

### 4. Conversation and agent orchestration
These tables persist the chat and each agent execution cycle.

- `chat_threads`
- `chat_messages`
- `agent_runs`
- `agent_run_effects`

### 5. Audit
This table provides a cross-cutting event trail.

- `activity_log`

---

## Entity descriptions

## `users`
Stores the authenticated user profile required by the application.

This should remain minimal, because authentication should primarily be handled by the external identity provider.

Key fields:
- `email`
- `display_name`
- `auth_provider`
- `auth_provider_user_id`

---

## `organisations`
Represents the user’s top-level working context.

This is intentionally distinct from `companies`. An organisation is the owner/collaboration container, while a company is the venture or business concept being shaped.

Example:
- Organisation: "Ralfe’s workspace"
- Company: "Northstar Ventures"

---

## `organisation_members`
Links users to organisations and assigns a role such as owner, editor, viewer, or admin.

This is not strictly essential for a single-user prototype, but it is worth introducing early because collaboration is clearly part of the product direction.

The original draft called this table `workspace_members`, but because it actually models organisation-level membership, `organisation_members` is the clearer and more accurate name.

---

## `companies`
Represents a venture or business being developed in HelmOS.

The current dropdown in the prototype would likely be backed by this table.

The `branding` field can remain flexible as `JSONB`, for example:

```json
{
  "logoUrl": "/assets/logos/northstar.svg",
  "primaryColour": "#5B6CFF",
  "secondaryColour": "#0F172A"
}
```

---

## `workspaces`
Represents a concrete strategic workspace attached to a company.

Even if there is only one workspace per company at MVP stage, this abstraction is valuable because later a company may have multiple workspaces or streams such as:

- initial business concept
- investor pitch preparation
- growth strategy
- product-market-fit exploration

---

## `strategy_documents`
Represents the structured artefact shown in the central area of the UI.

For the MVP, there will likely be one row per workspace for `document_type = 'ideation'`.

Important fields:
- `completeness_percent`
- `quality_state`
- `agent_summary`

These are the document-level values used to drive overview widgets such as “Ideation completeness” and “Best next action”.

---

## `strategy_sections`
Stores the actual editable ideation sections shown as cards in the centre panel.

Examples:
- `problem_statement`
- `target_customer`
- `value_proposition`

This table should be considered the **authoritative business content model**.

Recommended approach:
- store the main text in `content`
- store UI and scoring metadata in `metadata`
- keep `section_key` stable and code-friendly
- use `display_order` to control rendering order

---

## `section_versions`
Stores revision history for each strategy section.

This is what enables:
- “View changes”
- version rollback
- auditability of agent edits
- explainability when a user asks what changed

Every substantive update to `strategy_sections.content` should insert a corresponding `section_versions` row.

---

## `document_insights`
Stores generated insights about the document as a whole.

Useful examples:
- completeness summary
- recommended next action
- quality assessment
- warning or refinement prompts

These could be recomputed on demand, but persisting the latest insight snapshot is practical for the MVP.

---

## `stage_progress`
Tracks the left-hand navigation state and future unlock logic.

Even though only Ideation is in scope now, this table is worth keeping because the UI already shows the concept of locked and unlocked stages.

Initial `stage_key` values:
- `ideation`
- `value_proposition`
- `customer_segments`
- `business_model`
- `market_research`

The `quality_checks` JSONB field can store the internal gating conditions used to decide whether a stage unlocks.

---

## `chat_threads`
Represents the persistent conversation stream shown on the right-hand side.

A workspace will usually have one active ideation thread, but modelling it as a thread allows future support for:
- multiple conversation topics
- archived discussions
- context-specific threads

---

## `chat_messages`
Stores individual user, agent, and system messages.

This table should only store conversational content, not structured business state.

Useful metadata may include:
- which section(s) the message relates to
- message intent
- UI timestamp or local rendering hints

---

## `agent_runs`
Captures each agent processing cycle.

One typical sequence is:

1. user sends a chat message
2. system creates an `agent_runs` record
3. agent analyses the prompt and current document
4. agent updates one or more strategy sections
5. system records completion, errors, and summary

This table is extremely important once you need:
- debugging
- observability
- cost analysis
- model version tracking
- governance of autonomous actions

---

## `agent_run_effects`
Stores the concrete effects of an agent run.

Examples:
- section updated
- completeness recalculated
- stage status changed
- next action refreshed

This is cleaner than burying all effects in a free-text summary and will help later with analytics and explainability.

---

## `activity_log`
Provides a general audit trail across the workspace.

Example event types:
- `section.updated`
- `section.versioned`
- `chat.message_added`
- `agent.run_completed`
- `stage.unlocked`

This is optional for a very lean MVP, but recommended.

---

## Cardinality overview

The main relationships are:

- one organisation has many companies
- one company has many workspaces
- one workspace has one ideation document
- one document has many sections
- one section has many versions
- one workspace has many chat threads
- one thread has many messages
- one thread has many agent runs
- one agent run may produce many effects
- one workspace has many stage progress rows

---

## Recommended enum domains

To avoid free-text drift, these should be constrained as database enums or check constraints.

### Section refinement state
- `empty`
- `draft`
- `needs_refinement`
- `good`
- `strong`

### Agent confidence
- `low`
- `medium`
- `high`

### Workspace stage
- `ideation`
- `value_proposition`
- `customer_segments`
- `business_model`
- `market_research`

### Stage status
- `locked`
- `current`
- `available`
- `completed`

### Sender type
- `user`
- `agent`
- `system`

### Agent run status
- `queued`
- `running`
- `completed`
- `failed`

---

## Suggested MVP seed sections

For the current prototype, initialise the ideation document with these sections:

1. `problem_statement`
2. `target_customer`
3. `value_proposition`

Later likely additions:
- `solution_concept`
- `revenue_model`
- `channels`
- `key_assumptions`
- `evidence_and_validation`

---

## Suggested completeness calculation

The overall document completeness should be derived from section-level completeness rather than manually edited.

Illustrative weighting:

- Problem Statement: 35%
- Target Customer: 30%
- Value Proposition: 35%

Formula:

```text
overall_completeness =
(problem_statement * 0.35) +
(target_customer * 0.30) +
(value_proposition * 0.35)
```

The result can then be persisted to `strategy_documents.completeness_percent`.

---

## What not to over-model yet

At this stage, avoid creating many highly specific columns such as:

- pain_description
- customer_budget_range
- value_prop_primary_benefit
- value_prop_secondary_benefit

That would make the MVP rigid too early.

A better compromise is:

- `content` for the main section text
- `metadata` JSONB for extracted or scored attributes
- later normalisation only when a field becomes operationally important

---

## Recommended implementation approach

For the backend, a clean service split would be:

### Workspace service
- users
- organisations
- members
- companies
- workspaces

### Ideation document service
- strategy documents
- sections
- section versions
- insights
- completeness rules

### Conversation service
- threads
- messages
- agent runs
- run effects

### Progress service
- stage progress
- unlock rules
- guidance logic

This separation keeps the chat subsystem from taking over the business-state model.

---

## Strongest architectural recommendation

The most important recommendation in this design is:

**Do not make chat history the source of truth for the business concept.**

The centre workspace needs stable, queryable, versioned entities. The chat is collaborative context, not the canonical document store.

That decision will make later features far easier to implement, including:

- section revision comparison
- deterministic UI rendering
- collaboration
- restore and rollback
- unlock logic
- analytics
- governance over agent actions

---

## Files included

This design guide accompanies:

- `helmos_mvp_ideation_erd.puml`
- `helmos_mvp_data_model_design_guide.md`
