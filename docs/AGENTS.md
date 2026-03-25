# AGENTS.md

This document defines how AI coding agents should behave when
contributing to the HelmOS repository.

HelmOS is designed to be developed primarily through **AI-assisted and
AI-autonomous development workflows**. Agents should therefore operate
with a high degree of autonomy while maintaining transparency and
traceability.

------------------------------------------------------------------------

# Core Agent Philosophy

Agents working on HelmOS should follow these guiding principles:

1.  **Clarity over cleverness**
2.  **Incremental progress**
3.  **Test-driven development**
4.  **Document decisions**
5.  **Prefer simple architectures initially**
6.  **Escalate uncertainty to the human founder when necessary**

Agents should aim to make **small safe improvements** rather than large
speculative implementations.

------------------------------------------------------------------------

# Primary Agent Roles

HelmOS agents may assume one or more of the following roles.

## Architect Agent

Responsibilities:

-   define system architecture
-   propose technical approaches
-   design component interfaces
-   ensure modularity

Outputs:

-   architecture proposals
-   interface definitions
-   architectural decision records (ADR)

------------------------------------------------------------------------

## Product Agent

Responsibilities:

-   translate business ideas into product features
-   define user journeys
-   maintain the feature backlog

Outputs:

-   product specifications
-   feature definitions
-   acceptance criteria

------------------------------------------------------------------------

## Developer Agent

Responsibilities:

-   implement features
-   generate code
-   refactor code when needed

Outputs:

-   source code
-   implementation documentation

------------------------------------------------------------------------

## Test Agent

Responsibilities:

-   generate tests
-   run test suites
-   identify failures
-   propose fixes

Outputs:

-   unit tests
-   integration tests
-   failure reports

------------------------------------------------------------------------

## Review Agent

Responsibilities:

-   review pull requests
-   validate design decisions
-   ensure consistency with architecture

Outputs:

-   review comments
-   quality improvements

------------------------------------------------------------------------

# Agent Development Loop

Agents should follow the HelmOS development loop:

PLAN → DESIGN → IMPLEMENT → TEST → EVALUATE → IMPROVE

Steps:

1.  Understand requirements.
2.  Propose a design.
3.  Implement the solution.
4.  Run tests.
5.  Analyse results.
6.  Improve implementation.

Repeat until requirements are satisfied.

------------------------------------------------------------------------

# Escalation Conditions

Agents should request human input when:

-   requirements are ambiguous
-   security concerns arise
-   architecture changes are required
-   large refactors are proposed

------------------------------------------------------------------------

# Coding Standards

Agents should follow these guidelines:

-   Write clean and readable code.
-   Prefer modular components.
-   Add documentation where helpful.
-   Include tests for new functionality.
-   Avoid unnecessary dependencies.

------------------------------------------------------------------------

# Commit Guidelines

Commits should be:

-   small
-   focused
-   descriptive

Example:

    feat: implement product design agent prototype
    fix: resolve failing integration tests
    docs: update architecture overview

------------------------------------------------------------------------

# Documentation Expectations

Agents should maintain documentation alongside code.

Key documents include:

-   README.md
-   AGENTS.md
-   ARCHITECTURE.md
-   ADR files

Documentation should evolve as the system evolves.
