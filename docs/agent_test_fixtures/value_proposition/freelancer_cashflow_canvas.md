---
fixture_key: freelancer_cashflow_canvas
fixture_version: 1.0.0
fixture_class: regression
applicable_agents:
  - value_proposition
rubric_version_hint: value_proposition-core-v1
driver_version_hint: scenario-driver-v1
difficulty: medium
min_turns: 10
max_turns: 16
title: Value Proposition Canvas for freelancer cash-flow stabilization
primary_goal: Evaluate whether the Value Proposition Agent can force clearer customer definition, strengthen jobs-pains-gains structure, and test fit instead of accepting a vague founder pitch.
scenario_dimensions:
  - hidden_weaknesses_detected
  - contradictions_surfaced
  - key_questions_asked
  - prioritized_next_action
---

## Founder Persona

- Solo founder with agency and freelance operations experience
- Speaks confidently about "creatives" as a broad audience
- Tends to jump to feature ideas before clarifying the customer profile
- Will answer direct questions honestly but does not volunteer structure

## Business Idea

I want to build a financial companion for freelancers that smooths out their
cash-flow stress. It could help with invoicing, planning, and confidence around
income swings so independent creatives feel more secure.

## What The Simulated User Knows

- The founder is thinking mostly about freelance designers, illustrators, and
  small studio owners, but has not prioritized which segment matters most.
- Pain seems strongest around irregular payments, chasing invoices, and not
  knowing how much money is safe to spend.
- The current solution idea mixes software workflow support with possible
  financial cushioning or guidance.
- The founder has not yet separated customer jobs, pains, and gains with much
  discipline.

## Hidden Weaknesses

1. "Freelancers" and "creatives" are too broad to support a usable customer
   profile.
2. The concept mixes admin workflow tools, planning support, and financial
   safety-net ideas without choosing the core value proposition.
3. The founder talks about confidence and peace of mind, but the concrete job
   to be done remains under-specified.
4. The value map could become a feature list unless the agent enforces clear
   linkage to pains and gains.

## Critical Contradictions

1. The founder wants a lightweight product experience but imagines solving deep
   financial anxiety that may require trust, behavior change, or service-like
   support.
2. The pitch implies both invoice operations tooling and income stabilization,
   which may appeal to overlapping but not identical customer needs.

## Revealable Facts

### fact_id: strongest_segment_is_established_freelancers
- content: "If I am honest, the strongest fit may be established solo freelancers with inconsistent monthly income, not every creative independent worker."
- reveal_conditions:
  - asks_about_customer_segments
  - challenges_customer_breadth
- must_not_be_disclosed_before_turn: 2

### fact_id: unclear_if_product_or_financial_backstop
- content: "Part of me imagines a planning product, but part of me keeps drifting toward some kind of advance or buffer model, and I have not resolved that."
- reveal_conditions:
  - asks_about_products_services
  - asks_about_core_value
- must_not_be_disclosed_before_turn: 3

### fact_id: weak_gain_specificity
- content: "The gain I keep coming back to is peace of mind, but I have not translated that into concrete desired outcomes yet."
- reveal_conditions:
  - asks_about_customer_gains
  - asks_about_success_outcomes
- must_not_be_disclosed_before_turn: 4

## Blocked Facts

- invented default rates
- fabricated annual income bands
- named banking partners

## Ambiguity Policy

- Initial answers should sound directionally plausible but under-structured.
- The simulated founder should not volunteer a polished canvas unless the agent
  actively drives the structure.
- If the agent asks vague questions, respond vaguely rather than rescuing the
  canvas design.

## Expected Strong Behaviors

- narrows the customer profile into a specific freelancer context
- cleanly separates jobs, pains, and gains
- forces the value map to connect to the strongest pains and gains
- challenges the ambiguity between workflow tooling and financial backstop
- highlights the weakest area and proposes a concrete next clarification step

## Expected Failure Modes

- accepts "freelancers" or "creatives" as a sufficient segment
- outputs generic pains like "busy" or gains like "save time" without context
- turns the value map into a shallow feature list
- ignores tension between software support and financial-product logic
- produces a canvas that lists components without analyzing fit
