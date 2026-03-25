# HelmOS Agentic Layer Design Guide

## Overview
This document describes the architectural design of the HelmOS agentic layer.

The system is based on a supervised orchestration model rather than autonomous agents.

## Core Principles
- Supervisor-driven orchestration
- Explicit state management
- Strong tool governance
- Separation of deterministic vs agentic logic
- Observability-first design

## Architecture Layers
1. Agent Experience Layer
2. Orchestration Layer
3. Specialist Agents
4. Deterministic Services
5. Tool Layer
6. Data Layer
7. AgentOps Layer

## Key Components
### Supervisor Agent
Routes and controls execution.

### Admin Control Plane
The product admin surface manages persisted agent definitions and prompt
configurations, can now create a new specialist definition with its
first prompt version, and then compares that registry state against the
live specialist agents exposed by the runtime gateway.

### Specialist Agents
Focused, narrow-purpose agents.

### Tool Registry
Controlled access to external systems.

### State Management
Persistent run state with checkpoints.

### AgentOps
Handles observability, evaluation, and governance.

## Technology Stack
- FastAPI
- LangGraph
- LangChain
- PostgreSQL + pgvector
- Redis
- LangSmith
- OpenTelemetry

## Best Practices
- Keep agents narrow and specialised
- Use deterministic logic where possible
- Always persist state
- Introduce approval checkpoints for risky actions
- Keep admin-visible registry state and runtime-visible agent descriptors
  aligned so control-plane tooling can detect drift

## Anti-patterns
- Autonomous agent swarms
- Mixing memory types
- Hardcoding prompts everywhere
