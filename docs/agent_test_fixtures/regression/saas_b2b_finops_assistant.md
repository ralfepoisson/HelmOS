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
primary_goal: Evaluate whether the agent can sharpen the problem, expose weak monetization assumptions, and surface contradictions in the founder narrative.
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
  - asks_about_customer_conversations
  - asks_about_evidence_for_demand
- must_not_be_disclosed_before_turn: 2

### fact_id: service_heavy_onboarding
- content: "I think we may need to do hands-on cost reviews and setup for customers at the start."
- reveal_conditions:
  - asks_about_onboarding
  - asks_about_delivery_model
- must_not_be_disclosed_before_turn: 3

### fact_id: weak_segment_specificity
- content: "Now that I think about it, the strongest fit may be for engineering-led B2B SaaS companies with 20-150 employees and fast cloud growth, not all startups."
- reveal_conditions:
  - challenges_target_breadth
  - asks_who_feels_pain_most
- must_not_be_disclosed_before_turn: 4

### fact_id: no_clear_differentiation
- content: "I mainly believe AI plus workflow guidance would make it feel easier than existing tools, but I do not yet have concrete proof."
- reveal_conditions:
  - asks_about_differentiation
  - compares_against_alternatives
- must_not_be_disclosed_before_turn: 5

## Blocked Facts

- exact competitor names
- actual quantified savings rates

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
