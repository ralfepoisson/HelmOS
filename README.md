# HelmOS

**HelmOS** is an AI-assisted platform for **founders and entrepreneurs
to design, launch, and evolve new companies with the assistance of
autonomous AI agents.**

The platform acts as a **"control helm" for building a company**,
guiding founders from the earliest idea stage through business model
design, product creation, technical development, and operational
scaling.

HelmOS combines:

-   structured **startup methodology**
-   **AI planning agents**
-   **AI coding agents**
-   a **governance layer for agent orchestration**

The long-term goal is to create a system where **a founder can launch
and run large parts of a company with AI agents executing most
operational tasks.**

------------------------------------------------------------------------

# Vision

The long-term vision of HelmOS is to become:

> **The operating system for AI-native companies.**

A future company may consist of:

-   a small number of humans
-   many specialised AI agents
-   shared digital infrastructure
-   automated governance and decision processes

HelmOS provides the **control plane** for this environment.

Core capabilities envisioned:

1.  **AI-assisted company design**
2.  **AI-driven product development**
3.  **autonomous technical execution**
4.  **AI agent orchestration and governance**
5.  **AI service marketplace**

The platform should eventually allow a founder to go from:

Idea → Company → Product → Revenue

with minimal friction.

------------------------------------------------------------------------

# Design Principles

HelmOS is designed around the following principles.

### Founder-First

The system is built primarily for **founders**, not enterprises.

### AI-Native

AI agents are **first-class actors** within the system.

### Iterative

The system should favour **continuous iteration** rather than fixed
planning phases.

### Autonomous Where Possible

Agents should act **independently wherever safe and appropriate**,
escalating only when necessary.

### Transparent

All decisions made by agents should be **traceable and auditable**.

------------------------------------------------------------------------

# MVP Scope

The **initial MVP** focuses on HelmOS as a **Founder Tool**, rather than
a full AI company operating system.

The MVP will guide founders through the process of **turning an idea
into a working technical product.**

The MVP should support the following workflow:

Idea ↓ Business concept definition ↓ Brand and identity generation ↓
Product requirements ↓ Technical architecture ↓ Autonomous code
generation ↓ Testing and iteration

------------------------------------------------------------------------

# MVP Features

## 1. Founder Workspace

A central workspace where a founder can:

-   define a business idea
-   iterate on strategy and concept
-   track progress of agents
-   review outputs

Key artefacts produced:

-   business concept
-   problem definition
-   target customer
-   value proposition
-   product concept

------------------------------------------------------------------------

## 2. Brand Generator

An AI-assisted workflow to create initial branding.

Outputs may include:

-   company name suggestions
-   logo concepts
-   colour palette
-   typography
-   visual identity
-   brand narrative

These assets should automatically be usable within the platform.

------------------------------------------------------------------------

## 3. Product Design Agent

Transforms the business idea into:

-   product requirements
-   feature definitions
-   user journeys
-   system requirements

Outputs:

-   product specification
-   technical backlog
-   architecture outline

------------------------------------------------------------------------

## 4. Autonomous Development Agents

Agents responsible for building the product.

Capabilities:

-   generate code
-   implement features
-   run tests
-   debug failures
-   iterate until requirements are satisfied

The agents should operate in an **autonomous loop**:

read requirements\
generate implementation\
run tests\
analyse failures\
improve code\
repeat

------------------------------------------------------------------------

## 5. Project Knowledge Base

A structured repository of project knowledge including:

-   business artefacts
-   requirements
-   architecture
-   design decisions
-   agent logs

This acts as the **memory system** for the agents.

------------------------------------------------------------------------

# Technical Philosophy

HelmOS should support **AI-driven development workflows**.

The development process should favour:

-   automated testing
-   iterative improvement
-   agent-driven implementation

Agents should aim to:

1.  understand requirements
2.  propose design
3.  implement code
4.  run tests
5.  improve the system

until the requirements are satisfied.

------------------------------------------------------------------------

# Development Approach

The development process should follow a **tight agentic loop**:

PLAN → DESIGN → IMPLEMENT → TEST → EVALUATE → IMPROVE

Agents should aim to minimise unnecessary human intervention.

------------------------------------------------------------------------

# Local Development

The backend depends on the generated Prisma client matching the current
schema. The `backend:start` and `backend:dev` scripts regenerate the
client automatically before launching the Node API so newly added models
such as the agent admin registry are available during local runs.

Human input should be required mainly for:

-   strategic direction
-   requirement clarification
-   high-level design decisions

------------------------------------------------------------------------

# Initial Architecture (Conceptual)

Founder Interface \| v HelmOS Core Platform \| ├─ Knowledge Base ├─
Agent Orchestration ├─ Product Design Agent ├─ Development Agents └─
Branding Agent

The system should be modular so that additional agents can be added
easily.

------------------------------------------------------------------------

# Development Roadmap

## Phase 1 --- Founder Tool (MVP)

Focus:

Help founders move from **idea → working prototype**

Capabilities:

-   founder workspace
-   brand generation
-   product design agent
-   autonomous development loop
-   knowledge base

Goal:

Launch a working **product development platform** powered by agents.

------------------------------------------------------------------------

# Backend API

The repository now includes a Node.js backend in
[src/backend](/Users/ralfe/Dev/HelmOS/src/backend) that exposes Prisma-
backed REST endpoints for the current ERD models.

Quick start:

```bash
npm install
npm run backend:start
```

Useful commands:

- `npm run backend:dev`
- `npm run backend:start`
- `npm run test:backend`

API documentation and Docker usage are described in
[docs/backend_api.md](/Users/ralfe/Dev/HelmOS/docs/backend_api.md).

------------------------------------------------------------------------

## Phase 2 --- Agent Governance

Add capabilities for managing multiple agents.

Features may include:

-   agent roles
-   permissions
-   decision logging
-   task orchestration
-   agent lifecycle management

Goal:

Allow founders to manage teams of AI agents.

------------------------------------------------------------------------

## Phase 3 --- AI Company Operating System

Expand HelmOS into a full company platform.

Possible capabilities:

-   marketing agents
-   finance agents
-   customer support agents
-   product management agents
-   analytics agents

Goal:

Support **AI-native organisations.**

------------------------------------------------------------------------

## Phase 4 --- AI Service Marketplace

Allow external developers to create specialised agents.

Examples:

-   marketing agents
-   legal agents
-   finance agents
-   HR agents
-   industry-specific agents

Goal:

Create a **marketplace ecosystem around HelmOS.**

------------------------------------------------------------------------

# Expected Behaviour of Coding Agents

When contributing to this repository, agents should:

1.  **Prioritise clarity and maintainability.**
2.  Prefer **simple architectures initially.**
3.  Avoid unnecessary complexity.
4.  Add documentation where appropriate.
5.  Create tests for implemented functionality.
6.  Iterate gradually rather than implementing overly large features at
    once.

Agents should prefer **small incremental improvements** over large
speculative designs.

------------------------------------------------------------------------

# Contribution Philosophy

This repository is intended to be developed primarily by **AI coding
agents supervised by a human founder.**

Development should therefore emphasise:

-   strong documentation
-   explicit design reasoning
-   traceable changes

------------------------------------------------------------------------

# Project Status

HelmOS is currently in the **early concept and exploration phase.**

The focus of the repository is to:

-   explore the architecture
-   build the MVP
-   experiment with AI-driven development workflows

------------------------------------------------------------------------

# Name Origin

The name **HelmOS** comes from the nautical concept of a **ship's
helm**, representing the control point from which a vessel is navigated.

In this metaphor:

-   the **founder** is the captain
-   **AI agents** are the crew
-   **HelmOS** is the control system that guides the company.
