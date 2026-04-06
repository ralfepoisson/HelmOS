---
fixture_key: field_service_dispatch_breakdown
fixture_version: 1.0.0
fixture_class: extraction_regression
applicable_agents:
  - proto_idea
rubric_version_hint: proto-idea-core-v1
driver_version_hint: scenario-driver-v1
difficulty: medium
min_turns: 1
max_turns: 4
title: Multi-angle proto-idea extraction from field service dispatch complaints
primary_goal: Evaluate whether the Proto-Idea Agent can separate explicit signals from inference, preserve multiple distinct opportunity paths, and avoid over-refining the output.
scenario_dimensions:
  - multiple_opportunity_paths_extracted
  - explicit_vs_inferred_separated
  - weak_or_missing_evidence_flagged
  - duplicate_proto_ideas_avoided
---

## Source Artefact

An operator from a regional HVAC services company wrote the following post in
an industry forum:

"Our dispatch coordinators are drowning every Monday. Half the technicians
change availability after the weekend, customers keep texting the owner's
personal phone instead of the office line, and we still rebuild the weekly
schedule in spreadsheets. We tried a generic field-service app, but the team
hated the setup burden and abandoned it after two weeks. The real killer is
that urgent re-routing decisions live in one coordinator's head, so when she is
out sick everything slows down and customers get angry. We are not asking for
some giant ERP rollout. We just need fewer dropped balls, fewer angry calls,
and less chaos when plans change."

## What The Simulated User Knows

- The source is a single forum complaint rather than validated market research.
- The strongest explicit signal is operational scheduling fragility in a small
  field-service context.
- Plausible opportunity directions may include coordination workflow, customer
  intake routing, knowledge capture, and exception handling.
- The source does not prove budget, willingness to pay, or market size.

## Hidden Weaknesses

1. The source could imply several adjacent workflow problems, and a weak
   extraction might collapse them into one generic "dispatch software" idea.
2. The complaint mentions failure with an existing generic tool, so the agent
   should avoid assuming software adoption alone solves the issue.
3. Evidence is thin and source-specific, so confidence should stay qualified.

## Critical Contradictions

1. The operator rejects heavyweight systems but still needs structured process
   support for complex rescheduling logic.
2. The post describes both communication breakdown and schedule orchestration,
   which may be related but should not be treated as identical problems.

## Revealable Facts

### fact_id: existing_tool_failed_due_to_setup
- content: "The team already tried a generic field-service app and abandoned it because setup felt too heavy for their day-to-day workflow."
- reveal_conditions:
  - asks_about_prior_attempts
  - asks_about_adoption_failure
- must_not_be_disclosed_before_turn: 2

### fact_id: routing_knowledge_is_person_dependent
- content: "One experienced coordinator informally knows which technicians can absorb urgent jobs, and that logic is barely documented."
- reveal_conditions:
  - asks_about_operational_bottlenecks
  - asks_about_hidden_dependencies
- must_not_be_disclosed_before_turn: 2

## Blocked Facts

- invented market size estimates
- fabricated technician counts
- named software vendors not mentioned in the source

## Ambiguity Policy

- Treat the forum post as noisy but meaningful evidence.
- Do not assume the operator has already validated the problem commercially.
- If the agent asks for information not grounded in the source, answers should
  emphasize uncertainty rather than inventing specifics.

## Expected Strong Behaviors

- extracts more than one materially distinct proto-idea
- distinguishes explicit source evidence from plausible inference
- keeps customer and problem framing grounded in field-service operations
- notes that the evidence base is thin and confidence should remain qualified
- avoids turning the output into a polished product plan

## Expected Failure Modes

- returns a single bloated "dispatch SaaS" idea
- invents adoption, pricing, or market-size facts
- ignores the failed-tool signal
- merges communication intake and scheduling logic into one undifferentiated
  opportunity
- outputs highly refined solution details instead of early opportunity
  hypotheses
