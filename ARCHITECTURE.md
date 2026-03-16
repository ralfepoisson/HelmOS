# ARCHITECTURE.md

This document describes the conceptual architecture of HelmOS.

The architecture will evolve over time, but this document provides a
**starting structure for development agents**.

------------------------------------------------------------------------

# System Overview

HelmOS acts as the **control platform for AI-assisted company creation
and development.**

The platform contains several major subsystems:

1.  Founder Interface
2.  HelmOS Core Platform
3.  Agent Orchestration Layer
4.  Knowledge Base
5.  AI Agents

------------------------------------------------------------------------

# High-Level Architecture

Founder Interface \| v HelmOS Core Platform \| ├── Knowledge Base ├──
Agent Orchestrator ├── Product Design Agent ├── Development Agents └──
Branding Agent

------------------------------------------------------------------------

# Founder Interface

The Founder Interface allows a human founder to:

-   define business ideas
-   review outputs
-   guide agent activity
-   approve decisions

Possible implementations:

-   Web application
-   CLI interface
-   API

------------------------------------------------------------------------

# HelmOS Core Platform

The core platform provides the foundational services of HelmOS.

Responsibilities:

-   manage projects
-   maintain project artefacts
-   orchestrate agent activity
-   track development progress

------------------------------------------------------------------------

# Agent Orchestration Layer

This layer coordinates the activity of AI agents.

Responsibilities:

-   assign tasks
-   monitor agent progress
-   manage agent roles
-   handle escalation

The orchestrator ensures agents operate within defined workflows.

------------------------------------------------------------------------

# Knowledge Base

The knowledge base stores all structured information related to a
project.

Examples:

-   business artefacts
-   product requirements
-   architecture diagrams
-   design decisions
-   test results

The knowledge base acts as **persistent memory for agents.**

------------------------------------------------------------------------

# AI Agents

HelmOS agents are specialised AI systems responsible for different
tasks.

Examples:

Product Agent - converts business ideas into product definitions

Developer Agents - generate and improve code

Testing Agents - generate and execute tests

Branding Agent - creates brand assets

------------------------------------------------------------------------

# Data Flow (Conceptual)

Idea → Product Definition → Architecture → Code → Tests → Iteration

Each stage produces artefacts that are stored in the knowledge base.

Agents read from and write to this knowledge base.

------------------------------------------------------------------------

# Modularity

HelmOS should be modular.

Agents and services should be implemented as independent components
where possible.

This allows:

-   easier experimentation
-   flexible agent development
-   future marketplace integration

------------------------------------------------------------------------

# Future Expansion

Future architecture may include:

-   agent governance system
-   multi-agent coordination
-   AI service marketplace
-   automated business operations

The architecture should remain flexible enough to support these future
capabilities.
