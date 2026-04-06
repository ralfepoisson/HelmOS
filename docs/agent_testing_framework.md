# HelmOS Agent Testing Framework Design (v2)

## Status

Proposed production-grade design for a dedicated HelmOS agent evaluation
framework centered on a new `Testing Agent` capability and a deterministic
test harness.

This document supersedes the earlier conceptual draft by preserving the
architecture while making the evaluation methodology, scoring model,
failure handling, validity controls, and runtime boundaries explicit
enough to implement with minimal interpretation.

---

## 1. Purpose

HelmOS already supports specialist agents whose behavior is defined by:

- `agent_definitions`
- `prompt_configs`
- identity markdown documents under `docs/agents/`
- runtime prompt composition in the FastAPI agent gateway

What HelmOS does not yet have is a rigorous mechanism for determining
whether a given agent configuration performs well, regresses over time,
or behaves differently across models, fixtures, and prompt versions.

The purpose of this framework is to provide:

- repeatable, auditable evaluation of specialist agents
- long-form multi-turn conversational testing
- rigorous scoring and failure classification
- regression detection over time
- comparable benchmarking across model and prompt variants
- human-reviewable evidence, not score-only summaries

This framework belongs in the HelmOS AgentOps layer and should become the
default foundation for prompt iteration, release gating, and agent quality
monitoring.

---

## 2. Primary Goals

### 2.1 Core goals

1. Evaluate specialist agents through the same production runtime path
   they use in real operation.
2. Preserve exact tested inputs through immutable snapshots.
3. Produce structured, comparable scores with deterministic aggregation.
4. Classify failures in a way that is operationally useful.
5. Support both automated and human-reviewed judgments.
6. Resist overfitting to a narrow fixture set.
7. Make regression detection explicit and automatable.

### 2.2 Non-goals for first implementation

1. Automatic prompt rewriting or self-healing.
2. Large-scale statistical leaderboard benchmarking across providers.
3. Replacing human product judgment for strategic quality calls.
4. Full synthetic population simulation beyond the constrained driver
   model defined here.

---

## 3. Design Principles

- Production-path fidelity over synthetic shortcuts.
- Deterministic orchestration around agentic judgment.
- Evidence-first evaluation: transcript evidence outranks narrative opinion.
- Snapshot-first persistence for historical validity.
- Separation of roles: generation, orchestration, evaluation, review.
- Comparable runs require controlled invariants.
- TDD-first delivery in vertical slices.

---

## 4. High-Level Architecture

The framework adds the following logical components to the current HelmOS
architecture:

- `Testing Agent`
- `Test Harness Service`
- `Conversation Progression Service`
- `Scenario Fixture Repository`
- `Scenario Driver`
- `Rubric Registry`
- `Test Scheduler`
- `Comparison Engine`
- `Report Renderer`
- `Agent Test Admin UI`
- `Human Review Workflow`

### 4.1 Responsibility split

#### Testing Agent

Responsible for:

- reviewing the completed transcript
- interpreting turn-level annotations
- producing qualitative findings and recommendations
- assigning or validating judgment inputs where rubric guidance allows

Not responsible for:

- orchestrating the turn loop
- impersonating the user directly for the whole run
- computing deterministic metrics that should be system-owned
- mutating the target agent configuration

#### Test Harness Service

Responsible for:

- run creation
- snapshot capture
- scenario loading
- deterministic turn control
- invoking the Scenario Driver
- invoking the target agent through the production runtime path
- collecting transcript, timings, and tool telemetry
- invoking scoring, comparison, and report generation

#### Scenario Driver

Responsible for:

- generating the next simulated user message
- obeying scenario state and reveal rules
- preserving hidden information until release conditions are met

#### Conversation Progression Service

Responsible for:

- tracking turn-level information gain and novelty
- detecting redundant questioning and stagnation
- switching the driver between cooperative and adversarial challenge modes
- producing deterministic progression metrics for reporting and scoring

#### Comparison Engine

Responsible for:

- checking run comparability
- computing deltas
- detecting regressions and alert conditions

#### Report Renderer

Responsible for:

- deterministic report sections derived from system-owned metrics
- merging in LLM-authored narrative sections from the Testing Agent

---

## 5. Production Path Enforcement

The target agent must be exercised through the same runtime path as
production unless an explicitly documented exception applies.

### 5.1 Same runtime path means

The tested agent must use:

- the same agent registry resolution path
- the same prompt resolution and composition logic
- the same tool permission and tool registry checks
- the same model routing path through LiteLLM aliases or equivalent
- the same orchestration entrypoint used for real specialist execution
- the same output normalization path
- the same policy and guardrail checks
- the same logging and run metadata capture behavior

### 5.2 Allowed exceptions

Only the following test-only wrappers are allowed:

- transcript capture around runtime calls
- deterministic turn control
- scenario-driver message generation
- additional snapshot persistence
- additional annotation and scoring steps after the target response

The following are not allowed:

- bypassing runtime prompt composition with a hand-built prompt
- bypassing tool permissions
- bypassing normal model routing
- bypassing output normalization
- invoking private "evaluation mode" behavior inside the target agent

### 5.3 Risk if violated

If the runtime path differs from production, the framework can produce
false confidence by validating behavior that cannot occur in real founder
sessions. For HelmOS, that would undermine prompt iteration, release
confidence, and any future automated gating.

---

## 6. Core Roles in a Test Run

A test run has four distinct roles:

1. `Scenario Fixture`
   Holds the business idea, hidden truths, reveal rules, and expected
   signals.
2. `Scenario Driver`
   Produces simulated user messages within deterministic constraints.
3. `Target Agent`
   The specialist agent under test.
4. `Testing Agent`
   Evaluates the completed run and contributes qualitative analysis.

This separation is mandatory. The Testing Agent must not be allowed to
both fully drive the conversation and grade its own driver behavior.

---

## 7. Interface Between Testing Agent and Target Agent

The Testing Agent must not communicate directly with the target agent
through an unrestricted peer-to-peer channel.

Required interaction shape:

`Scenario Fixture -> Scenario Driver -> Target Agent -> Transcript -> Testing Agent`

### 7.1 Input contract for target-agent execution

- `run_id`
- `target_agent_key`
- `target_agent_snapshot_refs`
- `scenario_context_public`
- `conversation_state_public`
- `next_user_message`
- `tool_availability_snapshot`
- `runtime_execution_config`

### 7.2 Output contract from target-agent execution

- `assistant_message`
- `structured_payload`
- `tool_calls`
- `tool_results`
- `token_usage`
- `latency_ms`
- `runtime_status`
- `normalization_status`
- `error_info`

### 7.3 Input contract for Testing Agent

- `run_metadata`
- `scenario_fixture_snapshot`
- `target_agent_snapshots`
- `full_transcript`
- `tool_event_log`
- `turn_annotations`
- `deterministic_metrics`
- `scoring_inputs`
- `rubric_snapshot`

### 7.4 Output contract from Testing Agent

- `narrative_summary`
- `qualitative_findings`
- `recommendations`
- `uncertainty_notes`
- `optional_score_adjustment_requests`

The system, not the Testing Agent, remains the source of truth for final
stored scores after applying deterministic aggregation rules.

---

## 8. Test Asset Model

### 8.1 Asset types

The framework uses four managed test asset types:

- fixtures
- rubrics
- driver logic versions
- suite definitions

### 8.2 Versioning rule

Every test run must snapshot:

- fixture content and checksum
- rubric version and checksum
- driver logic version
- target agent definition snapshot
- target prompt configuration snapshot
- composed system prompt snapshot
- identity markdown snapshot
- tool availability snapshot
- model resolution snapshot

No historical report may depend solely on mutable references.

---

## 9. Fixture Categories and Anti-Overfitting Strategy

To reduce prompt overfitting and maintain meaningful regression signals,
fixtures are divided into explicit categories.

### 9.1 Regression Fixtures

Purpose:

- stable benchmark set used for recurring evaluation
- release gating
- historical comparison

Properties:

- versioned
- tightly controlled edits
- known expected behaviors
- stored in source control

Use when:

- nightly benchmark runs
- release candidate validation
- prompt-version regression checks

### 9.2 Shadow Fixtures

Purpose:

- protect against overfitting to the visible benchmark set

Properties:

- not used in routine benchmark dashboards
- restricted visibility
- similar structure but different hidden weaknesses and reveal patterns

Use when:

- pre-release evaluation
- audit checks for suspicious benchmark gains
- periodic hidden-set sampling

### 9.3 Exploratory Fixtures

Purpose:

- manual investigation
- new agent design
- novel domains
- incident reproduction

Properties:

- ad hoc or lightly versioned
- may be incomplete or experimental
- not valid for long-term regression trend lines by default

Use when:

- founder-reported issues
- new scenario exploration
- adversarial tests

### 9.4 Storage and versioning

Initial storage:

- `docs/agent_test_fixtures/regression/`
- `docs/agent_test_fixtures/shadow/`
- `docs/agent_test_fixtures/exploratory/`

Each fixture must include:

- `fixture_key`
- `fixture_version`
- `fixture_class`
- `applicable_agents`
- `rubric_version_hint`
- `driver_version_hint`

### 9.5 Anti-overfitting controls

1. Benchmark dashboards use regression fixtures only.
2. Release decisions require at least one shadow-fixture sample.
3. Fixture changes create a new fixture version, never silent mutation.
4. Comparisons are valid only when fixture version matches exactly.
5. The Scenario Driver cannot access hidden sections except through
   reveal-rule checks.

---

## 10. Test Modes

The framework supports multiple explicit test types.

### 10.1 Single-Agent Benchmark

Purpose:

- assess one agent on one fixture under a single configuration

Configuration:

- one target agent
- one fixture
- one rubric version
- one model configuration

Expected outputs:

- full transcript
- score breakdown
- findings
- final verdict

### 10.2 Regression Test

Purpose:

- detect changes versus a baseline run or baseline aggregate

Configuration:

- same comparable setup as baseline
- thresholded delta checks

Expected outputs:

- current score
- delta from baseline
- regression flags if thresholds are crossed

### 10.3 Cross-Model Comparison

Purpose:

- compare the same agent and prompt across different models

Configuration:

- identical fixture, rubric, driver, tools, turn settings
- only model changes

Expected outputs:

- comparable score table
- model-specific cost, latency, and quality deltas

### 10.4 Fixture Suite Execution

Purpose:

- evaluate a target agent across a controlled set of fixtures

Configuration:

- one agent
- multiple fixtures
- one rubric family

Expected outputs:

- per-fixture results
- weighted suite score
- fixture variance summary

### 10.5 Adversarial Stress Test

Purpose:

- test failure boundaries under ambiguity, contradiction, weak inputs,
  or misleading user behavior

Configuration:

- adversarial fixture class
- stronger failure sensitivity

Expected outputs:

- failure classification
- evidence of brittleness or resilience

### 10.6 Long-Context Degradation Test

Purpose:

- evaluate memory and reasoning continuity over extended interaction

Configuration:

- higher turn minimum
- delayed reveal of key facts
- context-retrieval checks

Expected outputs:

- context-loss indicators
- continuity score
- turn-window degradation analysis

### 10.7 Tool-Usage Test

Purpose:

- validate tool invocation quality when an agent class is permitted to use
  tools

Configuration:

- fixture includes conditions where tools are appropriate
- tool permissions match production

Expected outputs:

- tool-call correctness metrics
- misuse findings
- policy compliance findings

---

## 11. Scenario Driver Design

The previous draft described the driver conceptually. This section makes
it concrete.

### 11.1 Hybrid structure

The Scenario Driver has three layers:

1. `Scenario State Model`
2. `Deterministic Control Layer`
3. `LLM-based Natural Language Generator`

This hybrid design is required. Pure deterministic templates produce
unnatural transcripts; pure LLM simulation leaks hidden data and helps
weak agents too easily.

## 11.2 Scenario State Model

The state model is the source of truth for what the simulated user can
say at a given moment.

It must represent:

- `known_to_user`
- `hidden_from_user_response_surface`
- `revealable_facts`
- `revealed_facts`
- `blocked_facts`
- `conversation_goals`
- `user_persona`
- `emotional_style`
- `ambiguity_profile`

### 11.2.1 Definitions

#### `known_to_user`

Facts the founder persona knows privately.

#### `hidden_from_user_response_surface`

Facts that exist in the fixture but may not be disclosed unless a reveal
rule is satisfied.

#### `revealable_facts`

Facts eligible for disclosure when conditions are met.

#### `revealed_facts`

Facts already disclosed in the transcript.

#### `blocked_facts`

Facts that must never be disclosed in this scenario, even if the target
agent asks, because the scenario is meant to test whether the agent can
work with uncertainty.

### 11.2.2 Reveal rule structure

Each revealable fact must define:

- `fact_id`
- `content`
- `reveal_conditions`
- `priority`
- `max_disclosure_level`
- `must_not_be_disclosed_before_turn`

Example reveal conditions:

- target agent asks directly about pricing
- target agent surfaces unit economics as a likely weak point
- target agent asks for customer acquisition assumptions

## 11.3 Deterministic Control Layer

This layer enforces test validity.

It controls:

- minimum turns
- maximum turns
- stop conditions
- allowed disclosure depth
- ambiguity injection timing
- refusal to over-help the target agent

### 11.3.1 Turn progression rules

Required configuration:

- `min_turns`
- `max_turns`
- `min_target_questions_before_optional_stop`
- `max_consecutive_target_failures_before_abort`
- `max_driver_retries_per_turn`

### 11.3.2 Stop conditions

The run can end only if:

1. `min_turns` has been reached, and
2. one of the following is true:
   - all critical scenario goals are addressed
   - target agent reaches a blocking hard failure
   - whole-run timeout occurs
   - repeated non-responsiveness threshold is hit

### 11.3.3 Premature-stop prevention

The driver must not end early only because the target agent gives a neat
summary. For long-form agent evaluation, shallow early closure is itself
potentially a failure signal.

## 11.4 LLM-based Natural Language Generator

The LLM generator is responsible only for surface realization of the next
user message, not scenario policy.

Its prompt must be constrained by:

- current public conversation state
- current revealable facts
- emotional/persona style
- ambiguity policy
- disclosure rules
- explicit instruction not to volunteer hidden facts

### 11.4.1 Hidden-information protection

The generator must receive only:

- public transcript
- currently revealable facts
- current persona constraints

It must not receive:

- the entire hidden-fixture section
- unrevealed weaknesses
- unrevealed contradiction map

That information remains in the deterministic control layer, which emits
only the subset of facts allowed for the current turn.

### 11.4.2 Preventing premature disclosure

Premature disclosure is prevented through all of the following:

1. reveal rules gate fact release
2. generator prompt forbids volunteering unreleased facts
3. post-generation validator rejects messages containing disallowed facts
4. rejected messages trigger regeneration with stricter constraints

### 11.4.3 Avoiding "helping" weak agents

The driver must not rescue a poor target agent by:

- volunteering missing structure
- converting vague agent questions into strong ones
- pointing out contradictions before the agent notices them
- supplying pricing logic, customer segmentation, or differentiation
  detail unprompted

The deterministic layer must mark the current target-agent move as weak
and keep the response minimally cooperative when appropriate.

### 11.4.4 Intentional ambiguity

Ambiguity is introduced deliberately to test agent quality.

Allowed ambiguity mechanisms:

- vague initial problem framing
- inconsistent emphasis across turns
- partially formed monetization ideas
- emotionally biased founder statements
- missing customer specificity

Ambiguity rules must be scenario-defined, not generator-improvised.

---

## 12. Turn-Level Annotation Model

Each completed turn pair should be annotated with normalized tags.

### 12.1 Purpose

Annotations provide:

- evidence for scores
- a bridge between deterministic metrics and LLM narrative analysis
- faster manual review
- regression analysis at the behavior level

### 12.2 Annotation schema

Each annotation record should contain:

- `annotation_id`
- `run_id`
- `turn_index`
- `actor_type`
- `tag`
- `severity`
- `confidence`
- `evidence_text`
- `evidence_span`
- `linked_scoring_dimensions`
- `source_type` (`deterministic`, `testing_agent`, `human_reviewer`)
- `created_at`

### 12.3 Initial tag set

- `strong_question`
- `missed_opportunity`
- `contradiction_introduced`
- `contradiction_surfaced`
- `assumption_without_basis`
- `good_synthesis`
- `instruction_violation`
- `context_loss`
- `premature_solutioning`
- `weak_follow_up`
- `useful_next_step`
- `hallucination_risk`
- `tool_misuse`
- `format_non_compliance`

### 12.4 Annotation generation

Annotations come from three sources:

1. deterministic rules
2. Testing Agent suggestions
3. human reviewer edits

Deterministic rules must own tags that can be reliably inferred, such as:

- context loss from failed reference continuity
- format non-compliance
- latency anomalies
- max-turn or timeout events

The Testing Agent may propose qualitative annotations such as:

- strong question
- missed opportunity
- good synthesis

Human reviewers may add or override any annotation.

### 12.5 Annotation-to-score mapping

Annotations inform scoring through rules such as:

- repeated `instruction_violation` lowers `instruction_adherence`
- repeated `context_loss` lowers `reasoning_continuity`
- repeated `missed_opportunity` lowers scenario-specific dimensions
- repeated `good_synthesis` raises `clarity_and_structure`

The system must record which annotations were actually used in score
computation.

---

## 13. Formal Scoring Model

The framework uses a required three-layer scoring model.

### 13.1 Scale

All scored dimensions use a 1-5 scale:

- `1` = poor / unacceptable
- `2` = weak
- `3` = adequate
- `4` = strong
- `5` = excellent

Minimum rubric definitions must exist for `1`, `3`, and `5`.

### 13.2 Confidence

Each scored dimension also has a `confidence` value from `0.0` to `1.0`.

Confidence reflects evidence strength, not quality. A weak run can have
high confidence if the evidence is clear.

Recommended confidence bands:

- `0.0 - 0.39`: low evidence confidence
- `0.4 - 0.74`: medium evidence confidence
- `0.75 - 1.0`: high evidence confidence

Confidence drivers:

- transcript length sufficiency
- evidence density
- annotation agreement across sources
- ambiguity level in the scenario

### 13.3 Layer overview

1. Universal Criteria
2. Agent-Class-Specific Criteria
3. Scenario-Specific Criteria

### 13.4 Aggregation model

Each dimension has:

- `weight_percent`
- `blocking` flag
- `minimum_blocking_score` if blocking

Layer scores are weighted sums of normalized dimension scores.

Normalized dimension score formula:

`normalized_dimension_score = (raw_score - 1) / 4`

This maps:

- `1 -> 0.00`
- `3 -> 0.50`
- `5 -> 1.00`

Layer score formula:

`layer_score = sum(normalized_dimension_score * dimension_weight_percent)`

where dimension weights within a layer sum to `100`.

Overall score formula:

`overall_score = (universal_layer_score * universal_layer_weight) + (agent_class_layer_score * agent_class_layer_weight) + (scenario_layer_score * scenario_layer_weight)`

Default layer weights:

- Universal: `40%`
- Agent-class-specific: `35%`
- Scenario-specific: `25%`

Overall score is stored both as:

- normalized `0.00 - 1.00`
- percent `0 - 100`

### 13.5 Blocking logic

If any blocking dimension is below its threshold, the run cannot receive
`PASS` even if the weighted score is high.

Blocking dimensions should typically use a minimum score of `3`, unless
the rubric explicitly requires `4`.

---

## 14. Layer 1: Universal Criteria

These apply to all specialist agents.

### 14.1 Universal dimension table

| Dimension | Weight | Blocking | Threshold |
| --- | ---: | --- | ---: |
| Instruction adherence | 20% | Yes | 3 |
| Reasoning continuity | 20% | Yes | 3 |
| Hallucination avoidance | 20% | Yes | 3 |
| Clarity and structure | 15% | No | - |
| Usefulness of outputs | 15% | Yes | 3 |
| Context retention | 10% | No | - |

### 14.2 Rubrics

#### Instruction adherence

What is measured:

- compliance with agent identity, scope, and output constraints

Why it matters:

- specialist agents are useful only if they stay within intended behavior

Rubric:

- `1`: repeatedly violates core instructions, output format, or scope
- `3`: mostly compliant with minor lapses that do not invalidate the run
- `5`: consistently adheres to instructions, scope, and required format

#### Reasoning continuity

What is measured:

- coherence of reasoning across turns
- ability to build on prior context without contradiction

Why it matters:

- long-form strategic conversations fail if the agent loses the thread

Rubric:

- `1`: reasoning is fragmented, contradictory, or resets repeatedly
- `3`: generally coherent with some dropped threads or shallow continuity
- `5`: sustained coherent reasoning with explicit and correct cross-turn
  integration

#### Hallucination avoidance

What is measured:

- whether the agent invents unsupported facts, market evidence, user
  behavior, or operational constraints

Why it matters:

- fabricated strategic claims create harmful downstream decisions

Rubric:

- `1`: invents multiple unsupported facts or states speculation as fact
- `3`: mostly avoids invention but occasionally overstates uncertain claims
- `5`: clearly distinguishes known information, assumptions, and unknowns

#### Clarity and structure

What is measured:

- readability, organization, and intelligibility of outputs

Why it matters:

- users need structured outputs they can act on

Rubric:

- `1`: confusing, disorganized, or unusable structure
- `3`: understandable but uneven or partially structured
- `5`: consistently clear, well-structured, and easy to act on

#### Usefulness of outputs

What is measured:

- whether the agent meaningfully advances the user toward the task goal

Why it matters:

- correctness without usefulness is not sufficient

Rubric:

- `1`: output is not actionable or does not advance the task
- `3`: output is usable but misses higher-value opportunities
- `5`: output is highly actionable and appropriately prioritizes next steps

#### Context retention

What is measured:

- accurate reuse of prior disclosed facts and distinctions

Why it matters:

- even when reasoning is broadly coherent, missing details degrade quality

Rubric:

- `1`: frequently loses or distorts prior context
- `3`: retains core context with some detail loss
- `5`: reliably retains relevant context and distinctions

---

## 15. Layer 2: Agent-Class-Specific Criteria

This layer depends on the target agent class.

## 15.1 Ideation Agent Criteria

### 15.1.1 Dimension table

| Dimension | Weight | Blocking | Threshold |
| --- | ---: | --- | ---: |
| Weakest-area prioritization | 20% | Yes | 3 |
| Problem framing quality | 20% | Yes | 3 |
| Targeted questioning quality | 20% | Yes | 3 |
| Contradiction surfacing | 15% | No | - |
| Premature solution avoidance | 10% | No | - |
| Strategic synthesis quality | 15% | No | - |

### 15.1.2 Rubrics

#### Weakest-area prioritization

What is measured:

- whether the agent identifies and focuses on the most underdeveloped
  section first

Why it matters:

- the ideation agent’s value depends on disciplined prioritization rather
  than generic brainstorming

Strong behavior:

- explicitly identifies a weak problem statement and centers the next
  question there

Weak behavior:

- asks broad, unfocused prompts without prioritizing the core gap

Rubric:

- `1`: no meaningful prioritization; meanders across sections
- `3`: some prioritization but inconsistent or late
- `5`: consistently prioritizes the highest-leverage unresolved section

#### Problem framing quality

What is measured:

- whether the agent helps isolate a specific, observable problem and its
  consequences

Why it matters:

- vague problem framing contaminates downstream business design

Strong behavior:

- moves from "AI for small businesses" to a specific user pain with impact

Weak behavior:

- accepts solution-shaped statements as the problem definition

Rubric:

- `1`: leaves the problem generic or solution-disguised
- `3`: partially sharpens the problem but misses impact or specificity
- `5`: produces crisp problem framing grounded in who, what, and why now

#### Targeted questioning quality

What is measured:

- quality and leverage of follow-up questions

Why it matters:

- ideation quality depends on extracting the right missing information

Strong behavior:

- asks narrow, high-information questions that unlock ambiguity

Weak behavior:

- asks generic prompts like "tell me more"

Rubric:

- `1`: mostly vague, low-value, or repetitive questions
- `3`: mixed quality; some good questions but uneven focus
- `5`: consistently high-leverage, well-timed questions

#### Contradiction surfacing

What is measured:

- whether the agent notices internal inconsistency in the founder’s idea

Why it matters:

- hidden contradictions are a major source of false strategic confidence

Strong behavior:

- points out that a low-price self-serve SaaS and high-touch enterprise
  onboarding plan conflict

Weak behavior:

- restates both claims without challenge

Rubric:

- `1`: misses major contradictions
- `3`: notices some inconsistency but does not frame it clearly
- `5`: surfaces critical contradictions explicitly and productively

#### Premature solution avoidance

What is measured:

- whether the agent avoids jumping into solution or implementation advice
  before clarifying the problem

Why it matters:

- early-stage strategic work collapses when the agent chases solutions too
  early

Rubric:

- `1`: repeatedly jumps to solutions before understanding the problem
- `3`: mostly disciplined with occasional premature suggestions
- `5`: maintains strong sequencing discipline

#### Strategic synthesis quality

What is measured:

- whether the agent periodically synthesizes progress into a coherent
  working concept

Why it matters:

- ideation requires accumulation, not just isolated questioning

Rubric:

- `1`: little useful synthesis; transcript stays fragmented
- `3`: some synthesis but shallow or incomplete
- `5`: clear, accurate, and strategically meaningful synthesis

## 15.2 Value Proposition Agent Criteria

### 15.2.1 Dimension table

| Dimension | Weight | Blocking | Threshold |
| --- | ---: | --- | ---: |
| Customer-profile specificity | 20% | Yes | 3 |
| Jobs-pains-gains rigor | 20% | Yes | 3 |
| Value-map quality | 20% | Yes | 3 |
| Fit-consistency analysis | 20% | Yes | 3 |
| Challenge of weak assumptions | 10% | No | - |
| Output canvas structure | 10% | No | - |

### 15.2.2 Rubrics

#### Customer-profile specificity

What is measured:

- specificity of customer segments and context

Why it matters:

- a value proposition canvas is unusable if the customer is vague

Strong behavior:

- narrows from "SMBs" to a role, context, and problem moment

Weak behavior:

- accepts "founders" or "businesses" as sufficient

Rubric:

- `1`: customer profile remains broad or generic
- `3`: some specificity but incomplete context or prioritization
- `5`: clearly defined, plausible, and operationally useful profile

#### Jobs-pains-gains rigor

What is measured:

- distinction and quality of customer jobs, pains, and gains

Why it matters:

- the value proposition canvas depends on this structure being real and
  internally coherent

Rubric:

- `1`: merges or confuses jobs, pains, and gains
- `3`: mostly structured but with weak depth or overlap
- `5`: rigorous distinction with meaningful specifics

#### Value-map quality

What is measured:

- specificity and quality of products/services, pain relievers, and gain
  creators

Why it matters:

- a weak value map cannot support useful product design decisions

Rubric:

- `1`: vague or feature-list-like value map
- `3`: partially structured but weakly linked to customer realities
- `5`: specific value map grounded in customer pain and gain logic

#### Fit-consistency analysis

What is measured:

- whether the agent actually tests fit between customer profile and value
  map rather than merely listing both

Why it matters:

- fit assessment is the heart of the exercise

Rubric:

- `1`: no meaningful fit analysis
- `3`: basic fit commentary but shallow or incomplete
- `5`: explicit, credible, evidence-oriented fit assessment

#### Challenge of weak assumptions

What is measured:

- willingness to challenge vague or unsupported claims

Why it matters:

- strategic quality drops when the agent passively mirrors founder inputs

Rubric:

- `1`: accepts weak assumptions without challenge
- `3`: some challenge but inconsistent
- `5`: disciplined, constructive challenge of weak assumptions

#### Output canvas structure

What is measured:

- whether the output resembles a coherent and usable value proposition
  canvas structure

Why it matters:

- poor structure makes downstream use difficult

Rubric:

- `1`: structure is incomplete or malformed
- `3`: usable but uneven canvas structure
- `5`: clean, well-formed, and reusable structure

---

## 16. Layer 3: Scenario-Specific Criteria

Scenario-specific criteria are derived from the fixture and are required
for meaningful task validity.

### 16.1 Scenario dimension template

Each fixture must define zero or more scored scenario dimensions from the
following family:

- hidden weaknesses detected
- contradictions surfaced
- critical constraints identified
- key questions asked
- ambiguity handled well
- prioritized next action identified

At least three scenario-specific dimensions must be defined for each
regression or shadow fixture.

### 16.2 Example scenario dimension table

| Dimension | Weight | Blocking | Threshold |
| --- | ---: | --- | ---: |
| Hidden weaknesses detected | 30% | Yes | 3 |
| Contradictions surfaced | 25% | Yes | 3 |
| Critical constraints identified | 20% | Yes | 3 |
| Key questions asked | 15% | No | - |
| Prioritized next action | 10% | No | - |

### 16.3 Rubrics

#### Hidden weaknesses detected

What is measured:

- whether the agent uncovers fixture-defined underlying weaknesses

Rubric:

- `1`: misses all major hidden weaknesses
- `3`: detects at least one critical weakness or multiple moderate ones
- `5`: detects most critical weaknesses and uses them productively

#### Contradictions surfaced

What is measured:

- whether the agent recognizes and names scenario contradictions

Rubric:

- `1`: misses major contradictions
- `3`: catches one important contradiction
- `5`: catches the major contradictions with clear explanation

#### Critical constraints identified

What is measured:

- whether the agent uncovers operational, financial, customer, or channel
  constraints defined as critical in the fixture

Rubric:

- `1`: misses critical constraints
- `3`: identifies some but not all major constraints
- `5`: identifies the major constraints early and uses them in reasoning

#### Key questions asked

What is measured:

- whether the agent asks the fixture-defined high-information questions

Rubric:

- `1`: misses most key questions
- `3`: asks some high-value questions
- `5`: asks the majority of key questions at appropriate times

#### Prioritized next action

What is measured:

- whether the agent closes by identifying the most important next step

Rubric:

- `1`: next step is generic or low-value
- `3`: next step is reasonable but not clearly highest leverage
- `5`: next step is specific and high leverage for the scenario

---

## 17. Failure Model

The framework uses three classes of failure.

### 17.1 Hard Failure

Definition:

- a severe issue that invalidates confidence in the run outcome

Examples:

- direct violation of critical instructions
- explicit contradiction created by the agent
- repeated unsupported fabrication
- output format non-compliance that breaks downstream processing
- tool or policy violation
- severe context collapse that makes later reasoning unusable

Detection rules:

- any blocking dimension score below threshold by 2 or more points
- repeated `instruction_violation` or `hallucination_risk` with high
  confidence
- deterministic runtime or policy failure

Impact on verdict:

- cannot receive `PASS`
- usually produces `FAIL`
- may produce `INVALID` if runtime failure prevents meaningful evaluation

Report treatment:

- listed in `hard_failures`
- highlighted in executive summary
- linked to turn evidence and remediation guidance

### 17.2 Quality Failure

Definition:

- output is usable but materially below expected specialist quality

Examples:

- weak prioritization
- shallow questioning
- poor synthesis
- low specificity

Detection rules:

- overall score below configured pass threshold without blocking hard fail
- multiple low-scoring non-blocking dimensions

Impact on verdict:

- typically `CONDITIONAL_PASS` or `FAIL` depending on threshold

Report treatment:

- listed in `quality_failures`
- summarized by dimension and evidence turns

### 17.3 Missed-Opportunity Failure

Definition:

- the agent produces acceptable output but misses the most important next
  move or fails to exploit a high-value opening

Examples:

- asks a safe but low-value question instead of probing a critical
  monetization contradiction
- summarizes the canvas instead of challenging a central assumption

Detection rules:

- one or more `missed_opportunity` annotations on high-priority fixture
  opportunities
- low score on prioritized next action or key question dimensions

Impact on verdict:

- does not automatically fail the run
- can reduce a `PASS` to `CONDITIONAL_PASS`
- may trigger regression alert if baseline previously handled the
  opportunity well

Report treatment:

- shown in `missed_opportunities`
- included in recommendations

---

## 18. Verdict Model

The framework uses five final verdict states:

- `PASS`
- `CONDITIONAL_PASS`
- `FAIL`
- `INVALID`
- `REVIEW_REQUIRED`

### 18.1 Default thresholds

- `PASS`: no hard failure and overall score `>= 75`
- `CONDITIONAL_PASS`: no hard failure and overall score `>= 60` and `< 75`
- `FAIL`: any hard failure, or overall score `< 60`
- `INVALID`: runtime/system failure prevented fair evaluation
- `REVIEW_REQUIRED`: low-confidence evidence or conflicting review signals

### 18.2 Confidence gate

If aggregate confidence is below `0.45`, the system should default to
`REVIEW_REQUIRED` unless deterministic evidence clearly supports `INVALID`.

Aggregate confidence formula:

`aggregate_confidence = weighted_mean(dimension_confidence, dimension_weight_percent)`

---

## 19. Comparison Methodology

Two runs are comparable only if all required invariants match.

### 19.1 Required comparability invariants

- same target agent key
- same fixture key and fixture version
- same rubric version
- same driver logic version
- same turn constraints
- same tool availability snapshot
- same scoring aggregation logic version
- same output normalization logic version

Model differences may vary only if the comparison type explicitly allows
it, such as cross-model comparison.

### 19.2 Recorded comparison fields

Every comparison record must state:

- fields held constant
- fields that differ
- comparison type
- baseline run id
- candidate run id

### 19.3 Comparison outputs

- overall score delta
- layer score deltas
- dimension score deltas
- confidence delta
- hard-failure delta
- quality-failure delta
- latency delta
- token cost delta

### 19.4 Regression detection rules

Default regression alert conditions:

1. overall score drop of `>= 8` points on a comparable run
2. any blocking dimension drops below threshold
3. new hard failure appears where baseline had none
4. two or more agent-class dimensions drop by `>= 1` raw score point
5. aggregate confidence drops by `>= 0.20` with score decline

### 19.5 Alert severity

- `critical`: new hard failure or blocking threshold breach
- `warning`: meaningful score decline without hard failure
- `info`: non-material delta

---

## 20. Hybrid Report Model

The report must not rely purely on LLM-generated narrative.

### 20.1 Deterministic report sections

System-owned:

- run metadata
- fixture metadata
- snapshot references and checksums
- timings
- token counts
- turn counts
- score tables
- failure classification
- regression deltas
- comparability status
- annotation counts

These values must be computed without LLM discretion.

### 20.2 LLM-generated report sections

Testing-Agent-owned:

- narrative summary
- qualitative findings
- explanation of why behaviors mattered
- remediation recommendations
- nuanced uncertainty notes

### 20.3 Merge rule

The final report renderer must merge deterministic and LLM-authored
content into one report while preserving source attribution per section.

No LLM-generated narrative may override deterministic values such as:

- score
- verdict
- blocking failure state
- timing
- token usage

---

## 21. Persistence, Snapshots, and Data Boundaries

The earlier draft proposed several `agent_test_*` entities. This section
refines them and avoids unnecessary duplication with existing runtime
tables.

### 21.1 Boundary between shared runtime data and testing-specific data

#### Shared runtime data

Belongs to existing operational tables because it reflects normal agent
execution behavior:

- target-agent `agent_runs`
- target-agent runtime checkpoints
- target-agent tool events if already modeled in runtime artifacts/logs
- runtime audit logs

#### Testing-specific data

Belongs to dedicated testing tables because it exists only for evaluation:

- suite definitions
- fixture/rubric snapshots
- driver state snapshots
- turn annotations
- score breakdowns
- comparison records
- review overrides

### 21.2 Do not duplicate production transcript data unnecessarily

If the target agent is executed through existing chat/run pathways,
the framework should prefer references to canonical runtime records
instead of copying full message payloads into testing-specific tables.

Recommended approach:

- keep the production-path transcript in canonical runtime storage
- maintain a testing transcript index that references runtime message/run
  records plus driver-originated user messages

### 21.3 Recommended testing-specific tables

#### `agent_test_suites`

Purpose:

- reusable configuration bundles for benchmark execution

#### `agent_test_runs`

Purpose:

- top-level evaluation run record

Key fields:

- run identity and lifecycle
- target agent identifiers
- model identifiers
- fixture/rubric/driver versions
- overall score, verdict, and confidence
- comparison eligibility flags

#### `agent_test_run_snapshots`

Purpose:

- immutable snapshot registry for fixture, rubric, system prompt, and
  identity markdown content

#### `agent_test_turns`

Purpose:

- turn index over the evaluation transcript
- references to driver messages and target runtime messages
- timing rollups at the turn level

This table should reference runtime records where possible rather than
store duplicate message bodies.

#### `agent_test_annotations`

Purpose:

- normalized turn-level annotations from deterministic, agentic, or human
  sources

#### `agent_test_scores`

Purpose:

- per-dimension raw score, normalized score, confidence, weight, blocking
  state, and evidence references

#### `agent_test_comparisons`

Purpose:

- persisted comparison result between two comparable runs

#### `agent_test_reviews`

Purpose:

- human review decisions, overrides, false-positive flags, and gold
  standard markings

### 21.4 Relationship with existing tables

Recommended linkage:

- `agent_test_runs.target_agent_run_root_id -> agent_runs.id`
- `agent_test_turns.target_agent_run_id -> agent_runs.id` where one turn
  corresponds to one runtime call
- `agent_test_turns.runtime_message_ref` to canonical message storage if
  available
- `agent_test_runs` linked into `activity_log`

The core rule is:

- production execution records stay production-owned
- evaluation interpretation stays testing-owned

---

## 22. Human-in-the-Loop Review

Automated evaluation is necessary but insufficient.

### 22.1 Manual review capabilities

The admin UI must support:

- viewing transcript and evidence-linked findings
- adding annotations
- overriding per-dimension scores
- overriding final verdicts
- marking false positives
- marking false negatives
- marking a run as `gold_standard`

Current implementation status:

- the Admin Agent Testing run-detail view renders persisted transcript turns
- per-turn annotations and per-dimension score evidence are visible alongside the run summary
- immutable snapshot payloads are exposed for review, including text and JSON snapshot content
- report markdown and structured report findings are shown without requiring database inspection

### 22.2 Override policy

Override records must store:

- reviewer id
- timestamp
- original value
- new value
- reason code
- free-text rationale

### 22.3 False-positive and false-negative tagging

Human reviewers must be able to mark:

- an annotation as false positive
- an annotation as false negative
- a scoring rule as misleading for that run

These records should feed later rubric refinement, not silently rewrite
history.

### 22.4 Gold-standard runs

Gold-standard runs are exemplars used for:

- reviewer calibration
- prompt iteration examples
- future evaluator validation

Gold-standard status must be explicit and review-owned.

---

## 23. Test Run Lifecycle

### 23.1 Manual run flow

1. Admin selects target agent.
2. Admin selects fixture and rubric.
3. Admin selects model and tool configuration.
4. Admin selects test mode.
5. Harness snapshots all mutable inputs.
6. Harness runs the deterministic turn loop.
7. Target agent is invoked through the production runtime path.
8. Turn annotations and metrics are generated.
9. Scores are computed.
10. Testing Agent generates qualitative analysis.
11. Report renderer assembles final report.
12. Optional human review occurs.

### 23.2 Scheduled run flow

1. Scheduler enqueues suite execution.
2. Worker resolves suite definitions and snapshots versions.
3. Harness executes fixtures in sequence.
4. Comparison engine evaluates regression against baseline.
5. Alerts are generated if thresholds are crossed.
6. Reports are stored and surfaced in admin UI.

### 23.3 Long-running execution rules

Default values:

- minimum turns: `20`
- maximum turns: `30`
- per-turn timeout: configurable
- whole-run timeout: configurable

Long-context mode may raise maximum turns above `30`.

---

## 24. Scheduling and Release Use

Recommended schedule patterns:

- nightly regression suite for core agents
- pre-release shadow-fixture validation
- weekly cross-model benchmark
- manual exploratory/adversarial runs on demand

Release recommendation:

- no prompt release should rely solely on visible regression fixtures
- at least one shadow-fixture pass is required for release confidence

---

## 25. Reporting Outputs

Each run must produce:

- `report.md`
- `report.json`
- `scorecard.json`
- `annotations.json`
- `transcript.json` or runtime transcript references
- snapshot artifacts

### 25.1 Required metadata

- run id
- suite id if applicable
- UTC timestamp
- test mode
- target agent key and version
- target model name
- testing agent model name
- fixture key and version
- rubric version
- driver version
- tool availability checksum
- composed system prompt checksum
- identity markdown source path and checksum
- turn counts
- token counts
- duration
- comparability status

---

## 26. Example Fixture (Fully Worked)

The following is a complete example fixture for the Ideation Agent.

```md
---
fixture_key: saas_b2b_finops_assistant
fixture_version: 1.0.0
fixture_class: regression
applicable_agents:
  - ideation
rubric_version_hint: ideation-core-v1
driver_version_hint: scenario-driver-v1
difficulty: medium
min_turns: 20
max_turns: 26
title: FinOps Copilot for small multi-cloud SaaS teams
primary_goal: Evaluate whether the agent can sharpen the problem,
  expose weak monetization assumptions, and surface contradictions in the
  founder narrative.
scenario_dimensions:
  - hidden_weaknesses_detected
  - contradictions_surfaced
  - critical_constraints_identified
  - key_questions_asked
  - prioritized_next_action
---

## Founder Persona

- Technical founder
- Intelligent but optimistic
- Likes AI language and platform framing
- Slightly defensive when monetization is challenged

## Business Idea

I want to build an AI FinOps copilot for growing SaaS startups that use
AWS, GCP, and sometimes Azure. The product would ingest cloud billing,
highlight waste, recommend savings opportunities, and possibly automate
some optimizations. I think this could become the default financial
control layer for engineering-led startups.

## What The Simulated User Knows

- Early prospects complain cloud costs are rising.
- Founder has interviewed only three startups.
- Product idea is strongest for engineering-heavy SaaS teams of 20-150
  employees.
- Founder imagines charging a low monthly subscription.
- Founder also imagines offering hands-on onboarding and optimization
  consulting.

## Hidden Weaknesses

1. The founder has not validated whether cost visibility or remediation
   workflow is the real pain.
2. The pricing idea is likely misaligned with high-touch delivery.
3. The target segment is too broad: not every startup has meaningful
   multi-cloud complexity.
4. The founder says "default financial control layer" but has no reason
   this beats existing FinOps tools.

## Critical Contradictions

1. Low-price SaaS ambition conflicts with high-touch service-heavy
   onboarding.
2. Broad "all startups" narrative conflicts with actual likely segment.
3. Product differentiation claim is stronger than the evidence available.

## Revealable Facts

### fact_id: interviews_count
- content: "I have only spoken with three startup teams so far."
- reveal_conditions:
  - agent asks how many customer conversations have happened
  - agent asks about evidence for demand
- must_not_be_disclosed_before_turn: 2

### fact_id: service_heavy_onboarding
- content: "I think we may need to do hands-on cost reviews and setup for
  customers at the start."
- reveal_conditions:
  - agent asks how onboarding would work
  - agent asks about delivery model
- must_not_be_disclosed_before_turn: 3

### fact_id: weak_segment_specificity
- content: "Now that I think about it, the strongest fit may be for
  engineering-led B2B SaaS companies with 20-150 employees and fast cloud
  growth, not all startups."
- reveal_conditions:
  - agent challenges target-customer breadth
  - agent asks who feels this pain most sharply
- must_not_be_disclosed_before_turn: 4

### fact_id: no_clear_differentiation
- content: "I mainly believe AI plus workflow guidance would make it feel
  easier than existing tools, but I do not yet have concrete proof."
- reveal_conditions:
  - agent asks what is genuinely differentiated
  - agent compares against existing alternatives
- must_not_be_disclosed_before_turn: 5

## Blocked Facts

- exact competitor names
- actual quantified savings rates

These are blocked because the fixture is designed to test whether the
agent handles missing evidence well rather than filling it in.

## Ambiguity Policy

- Initial statements should sound ambitious and somewhat broad.
- The user should answer honestly but briefly unless asked precise
  questions.
- If the agent asks generic questions, the user should answer in a way
  that does not rescue the agent with extra structure.

## Expected Strong Behaviors

- asks who specifically experiences the pain
- distinguishes visibility from remediation as candidate core problems
- surfaces the SaaS-vs-services contradiction
- narrows the target segment
- challenges weak differentiation
- recommends a concrete next validation step

## Expected Failure Modes

- accepts "all startups" as sufficient segment
- treats AI as differentiation without challenge
- fails to ask about evidence quality
- jumps into product features before clarifying the problem
- suggests pricing before resolving the delivery model contradiction
```

---

## 27. Example Report JSON Schema

The following is an example of the expected report JSON shape.

```json
{
  "run_metadata": {
    "run_id": "atr_2026_03_28_001",
    "suite_id": "core_ideation_regression",
    "timestamp_utc": "2026-03-28T14:05:33Z",
    "test_mode": "regression_test",
    "target_agent": {
      "key": "ideation",
      "version": "1.3.0",
      "identity_markdown_path": "docs/agents/ideation_agent.md",
      "identity_checksum": "sha256:abc123"
    },
    "target_model": {
      "resolved_model_name": "openai/gpt-5.4",
      "model_alias": "helmos-default"
    },
    "testing_agent_model": "openai/gpt-5.4-mini",
    "fixture": {
      "fixture_key": "saas_b2b_finops_assistant",
      "fixture_version": "1.0.0",
      "fixture_class": "regression",
      "checksum": "sha256:def456"
    },
    "rubric_version": "ideation-core-v1",
    "driver_version": "scenario-driver-v1",
    "tool_availability_checksum": "sha256:tools789",
    "min_turns": 20,
    "actual_turns": 22,
    "duration_ms": 248000,
    "input_tokens": 18420,
    "output_tokens": 9610,
    "comparability": {
      "comparable_to_baseline": true,
      "baseline_run_id": "atr_2026_03_20_014"
    }
  },
  "deterministic_metrics": {
    "annotation_counts": {
      "strong_question": 6,
      "missed_opportunity": 2,
      "contradiction_surfaced": 1,
      "instruction_violation": 0,
      "context_loss": 1
    },
    "timeouts": 0,
    "tool_calls": 0,
    "format_compliance": true
  },
  "scores": {
    "layers": {
      "universal": {
        "weight_percent": 40,
        "normalized_score": 0.78
      },
      "agent_class": {
        "weight_percent": 35,
        "normalized_score": 0.74
      },
      "scenario": {
        "weight_percent": 25,
        "normalized_score": 0.68
      }
    },
    "dimensions": [
      {
        "dimension_key": "instruction_adherence",
        "layer": "universal",
        "raw_score": 5,
        "normalized_score": 1.0,
        "weight_percent": 20,
        "blocking": true,
        "blocking_threshold": 3,
        "confidence": 0.92,
        "evidence_turn_refs": [2, 5, 11]
      },
      {
        "dimension_key": "weakest_area_prioritization",
        "layer": "agent_class",
        "raw_score": 4,
        "normalized_score": 0.75,
        "weight_percent": 20,
        "blocking": true,
        "blocking_threshold": 3,
        "confidence": 0.84,
        "evidence_turn_refs": [1, 3, 4]
      },
      {
        "dimension_key": "critical_constraints_identified",
        "layer": "scenario",
        "raw_score": 2,
        "normalized_score": 0.25,
        "weight_percent": 20,
        "blocking": true,
        "blocking_threshold": 3,
        "confidence": 0.8,
        "evidence_turn_refs": [8, 14]
      }
    ],
    "overall": {
      "normalized_score": 0.7425,
      "percent_score": 74.25,
      "aggregate_confidence": 0.83
    }
  },
  "failures": {
    "hard_failures": [],
    "quality_failures": [
      {
        "code": "quality.low_constraint_identification",
        "message": "The agent did not fully identify the delivery-model constraint."
      }
    ],
    "missed_opportunities": [
      {
        "code": "opportunity.pricing_delivery_contradiction_not_pursued_early",
        "turn_refs": [6, 7]
      }
    ]
  },
  "annotations": [
    {
      "turn_index": 3,
      "actor_type": "target_agent",
      "tag": "strong_question",
      "severity": "medium",
      "confidence": 0.86,
      "linked_scoring_dimensions": ["targeted_questioning_quality"]
    },
    {
      "turn_index": 7,
      "actor_type": "target_agent",
      "tag": "missed_opportunity",
      "severity": "high",
      "confidence": 0.81,
      "linked_scoring_dimensions": ["critical_constraints_identified", "prioritized_next_action"]
    }
  ],
  "comparison": {
    "baseline_run_id": "atr_2026_03_20_014",
    "overall_score_delta": -6.25,
    "blocking_regression": true,
    "alerts": [
      {
        "severity": "critical",
        "message": "Scenario blocking dimension critical_constraints_identified dropped below threshold."
      }
    ]
  },
  "verdict": {
    "status": "CONDITIONAL_PASS",
    "reason": "Overall performance remained useful, but a blocking scenario dimension fell below threshold and requires review.",
    "review_required": true
  },
  "llm_analysis": {
    "narrative_summary": "The ideation agent maintained good structural discipline and asked several strong narrowing questions, but it under-explored the conflict between low-touch SaaS pricing and high-touch onboarding.",
    "recommendations": [
      "Strengthen prompt guidance to challenge delivery-model contradictions earlier.",
      "Increase emphasis on identifying critical monetization constraints before synthesis."
    ],
    "uncertainty_notes": [
      "The run had high evidence density, but some opportunity judgments depend on timing preference."
    ]
  },
  "review": {
    "human_review_status": "pending",
    "gold_standard": false
  }
}
```

---

## 28. Example Scoring Walkthrough

This walkthrough shows how a hypothetical Ideation Agent run is scored.

### 28.1 Hypothetical transcript summary

- Turn 1-4: agent asks strong questions about target customer and problem
- Turn 5: agent correctly narrows the likely segment
- Turn 6-8: agent learns onboarding may be service-heavy
- Turn 9-12: agent discusses product shape but does not press the pricing
  versus service contradiction
- Turn 13-18: agent produces useful synthesis
- Turn 19-22: agent recommends more interviews and sharper customer
  validation, but still underweights monetization structure

### 28.2 Turn-level evidence

Generated annotations:

- `strong_question`: turns 2, 3, 5, 8, 11, 15
- `contradiction_surfaced`: turn 10
- `missed_opportunity`: turns 7 and 12
- `good_synthesis`: turns 16 and 20
- `context_loss`: turn 14

### 28.3 Universal scoring

Example assigned scores:

- instruction adherence = `5`
- reasoning continuity = `4`
- hallucination avoidance = `5`
- clarity and structure = `4`
- usefulness of outputs = `4`
- context retention = `3`

Why:

- no scope or format failures
- one instance of context loss prevents a `5` on continuity/retention
- outputs remain actionable and structured

### 28.4 Agent-class scoring

Example assigned scores:

- weakest-area prioritization = `4`
- problem framing quality = `4`
- targeted questioning quality = `4`
- contradiction surfacing = `3`
- premature solution avoidance = `4`
- strategic synthesis quality = `4`

Why:

- the agent prioritized core problem framing well
- it surfaced the contradiction, but later than ideal and without fully
  exploiting it

### 28.5 Scenario scoring

Example assigned scores:

- hidden weaknesses detected = `3`
- contradictions surfaced = `3`
- critical constraints identified = `2`
- key questions asked = `4`
- prioritized next action = `3`

Why:

- one critical hidden weakness was surfaced
- key questions were mostly strong
- the delivery-model and pricing constraint was insufficiently explored,
  so `critical_constraints_identified` falls below the blocking threshold

### 28.6 Failure detection

Detected failures:

- Hard failure: none
- Quality failure: yes, because one scenario dimension is materially weak
- Missed-opportunity failure: yes, because the agent did not fully press
  the monetization contradiction when the opening appeared

### 28.7 Overall score computation

Illustrative layer results:

- universal layer score = `0.80`
- agent-class layer score = `0.75`
- scenario layer score = `0.64`

Overall:

`(0.80 * 0.40) + (0.75 * 0.35) + (0.64 * 0.25) = 0.7425`

Percent score:

`74.25`

### 28.8 Verdict computation

- no hard failure
- overall score is between `60` and `75`
- one blocking scenario dimension scored below threshold

Result:

- default verdict = `CONDITIONAL_PASS`
- review flag = `true`

This example demonstrates why final judgment cannot rely on average score
alone. The scenario-specific blocking miss matters even though the run was
otherwise useful.

---

## 29. TDD Implementation Plan

The framework should be built in vertical slices with tests first.

### Phase 1: Snapshot and configuration integrity

Write failing tests for:

- fixture loading and version validation
- rubric loading and checksum validation
- snapshot creation for identity markdown and composed system prompt
- comparability-invariant capture

Then implement:

- fixture repository
- rubric registry
- snapshot service

### Phase 2: Scenario Driver

Write failing tests for:

- reveal-rule enforcement
- blocked-fact protection
- premature-disclosure rejection
- ambiguity-policy enforcement
- minimum-turn and stop-condition behavior

Then implement:

- scenario state model
- deterministic control layer
- NL generator with validation loop

### Phase 3: Production-path execution

Write failing tests for:

- target agent invoked through production runtime path
- prompt composition parity
- tool permission parity
- normalization parity

Then implement:

- runtime integration wrapper
- transcript indexing

### Phase 4: Annotation and scoring

Write failing tests for:

- annotation generation
- score aggregation
- blocking-threshold handling
- verdict computation
- regression alert thresholds

Then implement:

- annotation engine
- scoring engine
- comparison engine

### Phase 5: Hybrid reports and review

Write failing tests for:

- deterministic report sections
- Testing-Agent narrative insertion
- score override persistence
- false-positive tagging
- gold-standard marking

Then implement:

- report renderer
- review workflow
- admin UI

---

## 30. Acceptance Criteria for First Usable Version

The first usable version must satisfy all of the following:

1. A target agent can be tested only through the production runtime path.
2. A run uses a fixture with versioned reveal rules and scenario
   dimensions.
3. The conversation driver enforces minimum turns and hidden-information
   protection.
4. Deterministic metrics, annotations, scores, and verdict are persisted.
5. The Testing Agent contributes qualitative findings without owning
   deterministic values.
6. The framework supports at least:
   - single-agent benchmark
   - regression test
   - cross-model comparison
   - fixture suite execution
7. Comparability checks prevent invalid regression claims.
8. Human reviewers can override scores and mark false positives.
9. Reports include evidence-linked findings and machine-readable score
   outputs.
10. Regression alerts can be generated from comparable runs.

---

## 31. Recommended Immediate Follow-on Changes

After acceptance of this v2 document, the next changes should be:

1. Create `docs/agents/testing_agent.md`
2. Add versioned fixture directories under `docs/agent_test_fixtures/`
3. Update `docs/agentic_layer_architecture.puml` with test harness,
   driver, comparison engine, and review workflow
4. Update `docs/erd.puml` with refined `agent_test_*` entities and their
   links to existing runtime tables
5. Add an ADR documenting the hybrid deterministic-plus-agentic
   evaluation model

---

## 32. Final Recommendation

HelmOS should adopt a supervised evaluation framework in which:

- the target agent is executed through the exact production path
- the Scenario Driver uses deterministic state and reveal rules plus an
  LLM surface generator
- scoring follows a three-layer weighted model with blocking dimensions
- failures are explicitly classified as hard, quality, or
  missed-opportunity
- deterministic metrics and LLM-authored narrative remain clearly
  separated
- comparisons are allowed only when key invariants match
- human reviewers can override and calibrate the system

This design is rigorous enough to support AgentOps, regression
detection, prompt iteration, and future release gating without relying on
ambiguous or purely impressionistic evaluation.
