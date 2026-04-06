# Idea Refinery (Idea Foundry) – Concept & Design

## 1. Overview

The **Idea Refinery** is a core component of HelmOS responsible for discovering, transforming, and curating high-quality **business opportunities**.

It operates as an **AI-driven opportunity discovery and refinement system**, taking raw, unstructured signals ("idea ore") from the web and systematically evolving them into structured, high-confidence business opportunities.

Unlike traditional idea generators, the Idea Refinery does not aim to *generate ideas*, but to:

* Discover signals of unmet needs or emerging patterns
* Transform weak or incomplete ideas into stronger opportunities
* Evaluate readiness for further strategic development
* Continuously improve its own process over time

The output of the Idea Refinery feeds directly into the **Strategy Copilot**, where opportunities are further developed into operational business plans.

---

## 2. Core Principles

### 2.1 Transformation over Generation

The system does not rely on generating ideas from scratch. Instead, it:

* mines real-world signals
* extracts proto-ideas
* transforms them using structured reasoning

### 2.2 Separation of Concerns

* **Refinement** = improving ideas
* **Evaluation** = deciding whether ideas should progress

These functions are explicitly separated.

### 2.3 Iterative Evolution

Ideas are refined through multiple cycles:

* challenge
* expansion
* restructuring
* enrichment

### 2.4 Nothing is Wasted

Ideas are never truly discarded:

* rejected ideas are stored
* latent ideas are reused
* recombination generates new opportunities

### 2.5 Human-in-the-Loop (Future)

The system is designed to support human intervention, but initial versions may operate autonomously with optional review checkpoints.

---

## 3. High-Level Pipeline

The Idea Refinery consists of the following stages:

```
Prospecting → Proto-Idea Extraction → Idea Refinement ↔ Idea Evaluation → Output
                              ↓
                      Recombination Engine
```

---

## 4. Pipeline Stages

### 4.1 Prospecting

**Purpose:** Identify raw signals from external sources.

#### Inputs:

* Web sources (forums, news, blogs, social media)
* Trend data
* User-provided inputs (optional)

#### Functions:

* Search strategy generation
* Query execution
* URL/content deduplication
* Content normalisation

Current implementation note:

* Prospecting Configuration stores the latest prospecting strategy
* Prospecting Execution uses that saved strategy to run shared web search queries
* Normalised source records are persisted for the next Prospecting Agent review cycle
* The UI now loads prospecting configuration state separately from transactional pipeline contents so configuration reads do not double as source-record reads
* Running the Prospecting Agent now forms a closed loop: it reviews the latest stored result records, tweaks the strategy, then immediately re-executes the updated strategy so quality can improve over time
* A backend prospecting runtime now checks for due prospecting configurations every minute and runs the Prospecting Agent plus Prospecting Execution on an enforced hourly schedule
* The runtime honours a persisted `nextRunAt` slot when one exists, and only falls back to the last completed run time when a next slot is missing
* The enforced hourly cadence is now written back into the saved UI snapshot as well, so the operator-facing schedule stays aligned with `nextRunAt`
* Local Prisma-backed control-plane startup must target the `helmos` Postgres schema (`?schema=helmos`) or the runtime and overview reads will fall back to missing-table errors against `public`
* When a quoted boolean-style search query returns zero results, Prospecting Execution now retries once with a simplified plain-language version before persisting an empty outcome
* Persisted `RUNNING` states are treated as recoverable on the next due hourly slot so an interrupted process cannot strand a configuration indefinitely
* Idea Foundry no longer ships runtime demo cards or mock prospecting configuration data; when no persisted records exist, the UI renders explicit empty states instead of plausible-looking placeholders

#### Output:

* Normalised raw source artefacts

---

### 4.2 Proto-Idea Extraction

**Purpose:** Convert unstructured signals into structured proto-ideas.

#### Functions:

* Extract core problem or opportunity
* Identify implicit needs
* Structure into a basic idea format

Current implementation note:

* The stage now reads normalized source artefacts from persisted Prospecting Execution result records
* Source processing state is persisted in `proto_idea_sources` with `PENDING`, `PROCESSING`, `COMPLETED`, and `FAILED` states
* Each source is claimed deterministically in oldest-unprocessed-first order using a stable per-source key so interrupted runs can resume safely
* The Proto-Idea Agent identity is loaded from `docs/agents/proto-idea_agent.md` and injected into the extraction prompt for each source
* An administrator-facing Proto-Idea Extraction page now persists a structured extraction policy covering breadth, inference tolerance, novelty bias, signal threshold, and max proto-ideas per source
* The saved policy is injected into each Proto-Idea Agent run as structured runtime guidance instead of ad hoc prompt editing
* Manual Proto-Idea runs from the administrator UI are scoped to the signed-in operator's own prospecting records so the resulting proto-ideas appear in that operator's pipeline view
* Validated outputs are stored as one-to-many `proto_ideas` records linked back to their claimed source row
* Explicit signals, inferred signals, assumptions, open questions, qualitative confidence, and raw LLM payloads are preserved for downstream refinement
* Obvious duplicate proto-ideas returned for the same source are merged before persistence, and the source-level deduplication note records what happened
* Each processed source records the extraction policy id plus a policy snapshot for reproducibility and later continuous-improvement analysis
* A backend runner command, `npm run proto-ideas:run`, executes a controlled extraction pass and can optionally retry failed sources via environment flags

#### Output Example:

```
{
  "problem": "...",
  "observed_signal": "...",
  "potential_opportunity": "...",
  "context": {...}
}
```

---

### 4.3 Idea Refinement (Core Engine)

**Purpose:** Transform proto-ideas into stronger, more viable opportunities.

#### Characteristics:

* Iterative
* Tool-driven
* Non-linear

#### Functions:

* Apply cognitive tools (see Section 6)
* Expand, challenge, and restructure ideas
* Improve clarity, differentiation, and feasibility

#### Example Transformations:

* Inversion (reverse business model)
* Analogy (borrow from another domain)
* Constraint removal
* Failure analysis

#### Output:

* Refined idea object (structured and enriched)

Current implementation note:

* The stage now persists a structured `idea_refinement_policies` record that administrators can edit from the Idea Foundry UI
* The Idea Refinement page exposes bounded policy controls for depth, creativity, strictness, conceptual-tool count, and internal quality threshold
* Runtime assembly now loads the static Idea Refinement Agent identity from `docs/agents/idea_refinement_agent.md`, appends the saved policy, selected conceptual tools, and the current proto-idea as structured context, then invokes the registered refinement agent
* Active conceptual tools are loaded from the database at run time and selected deterministically per proto-idea using lightweight weakness heuristics rather than a free-form or all-tools prompt dump
* Refinement processing state is now tracked directly on `proto_ideas` using `PENDING`, `PROCESSING`, `COMPLETED`, and `FAILED` lifecycle markers so runs remain inspectable and retryable
* Validated outputs are stored in `idea_candidates`, linked back to their source proto-idea, stamped with the policy used, the selected conceptual tool ids, a deduplicating fingerprint, and an explicit refinement iteration number
* A lightweight internal quality check now rejects weak or contradictory outputs before persistence instead of silently accepting any syntactically valid JSON
* The Idea Foundry overview board and the dedicated Idea Refinement screen now render persisted idea candidates, showing linkage back to the proto-idea plus the selected conceptual tools used during refinement
* A backend runner command, `npm run idea-refinement:run`, executes a controlled refinement pass and can optionally target a specific proto-idea or retry failed refinements through environment flags

---

### 4.4 Idea Evaluation (Quality Gate)

**Purpose:** Decide whether an idea should progress.

#### Key Role:

* Hard filter (prevents low-quality ideas from progressing)
* Feedback loop to refinement

#### Outcomes:

1. **Pass** → move to Strategy Copilot
2. **Refine** → return to refinement loop
3. **Reject (Latent)** → store for recombination
4. **Reject (Dead)** → discard

---

### 4.5 Output

Final outputs are:

* High-confidence business opportunities
* Structured, traceable, and ready for strategic development

---

## 5. Recombination Engine

### Purpose:

Generate new opportunities from previously discarded or latent artefacts.

### Inputs:

* Rejected proto-ideas
* Rejected refined ideas
* Raw source artefacts

### Process:

* Identify complementary ideas
* Combine or mutate ideas
* Generate synthetic new sources

### Output:

* New candidate inputs fed back into Prospecting

### Constraints:

* Only include artefacts with at least one strong signal
* Avoid random or incoherent combinations

---

## 6. Cognitive Tools (Horizontal Layer)

Cognitive tools are reusable reasoning primitives available to agents.

They are **not tied to a specific pipeline stage**.

### Categories:

#### Diagnostic Tools

* Problem decomposition
* Assumption mapping

#### Transformative Tools

* Inversion
* Analogy transfer
* Constraint removal

#### Evaluative Tools

* Failure analysis
* Feasibility assessment
* Pre-mortem

#### Generative Tools

* Variant generation
* Combination
* Expansion

---

### Tool Structure (Example)

```
{
  "name": "Inversion",
  "purpose": "Reverse core assumptions",
  "when_to_use": ["high saturation"],
  "method": [...],
  "output": {...}
}
```

---

## 7. Idea Object Model (Conceptual)

Each idea should be represented as a structured object:

```
{
  "id": "...",
  "origin": "external | recombined",
  "raw_sources": [...],
  "proto_idea": {...},
  "refined_versions": [...],
  "scores": {
    "novelty": ...,
    "feasibility": ...,
    "market_signal": ...
  },
  "status": "...",
  "history": [...],
  "relationships": [...]
}
```

---

## 8. Evaluation Dimensions

Quality is multi-dimensional, not binary.

### Core dimensions:

* Novelty
* Feasibility
* Market Signal
* Differentiation
* Clarity

### Decision Logic:

* Must meet minimum thresholds
* Must show at least one strong signal

---

## 9. Data & Lineage

All stages persist outputs.

### Requirements:

* Full traceability
* Transformation history
* Tool usage tracking
* Decision rationale

---

## 10. Continuous Improvement (Meta Layer)

A dedicated **Idea Refinery Continuous Improvement Agent** evaluates system performance.

### Responsibilities:

* Sample outputs across stages
* Identify weaknesses
* Analyse tool effectiveness
* Recommend improvements

### Constraints:

* Does not directly modify system
* Produces recommendations
* Changes must be approved

---

## 11. System Behaviour Summary

The Idea Refinery is:

* A transformation system (not generator)
* A filtering system (via evaluation)
* A learning system (via meta-layer)
* A generative system (via recombination)

---

## 12. Positioning

The Idea Refinery provides:

> High-confidence business opportunities derived from real-world signals and structured reasoning.

It is the **entry point into HelmOS**, enabling users to move from:

* uncertainty
  → opportunity
  → structured business concept

---

## 13. MVP Scope (Recommended)

### Include:

* Prospecting
* Proto-Idea Extraction
* Basic Refinement (limited tools)
* Evaluation (simple scoring)
* Basic persistence

### Defer:

* Advanced recombination
* Full lineage graph
* Meta optimisation automation
* Complex orchestration

---

## 14. Future Evolution

* Personalised opportunity streams
* Domain-specific refinement models
* Integration with Strategy Copilot
* Real-world feedback loops
* Autonomous opportunity discovery cycles

---

## 15. Key Differentiator

The Idea Refinery is not an idea generator.

It is:

> A system that systematically improves ideas until they become viable opportunities.

---
