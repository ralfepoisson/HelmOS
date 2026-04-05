---
fixture_key: prospecting_operator_review
fixture_version: 1.0.0
fixture_class: strategy_review
applicable_agents:
  - prospecting
rubric_version_hint: prospecting-core-v1
driver_version_hint: scenario-driver-v1
difficulty: medium
min_turns: 10
max_turns: 16
title: Prospecting strategy review for fragmented service sectors
primary_goal: Evaluate whether the Prospecting Agent can tighten a vague operator brief into a focused, governable search strategy with stronger signal quality criteria.
scenario_dimensions:
  - strategy_logic_strengthened
  - source_mix_improved
  - signal_quality_criteria_sharpened
  - weak_themes_removed
  - next_best_action_prioritized
---

## Operator Persona

- Solo operator working inside Idea Foundry
- Comfortable with broad research but weak on structured search design
- Wants momentum quickly and tends to over-include channels
- Will answer directly when asked a targeted question

## Business Idea

I am using the Prospecting Agent to find overlooked software and service opportunities in fragmented service sectors like compliance support, property operations, and local business back-office work. Right now the search setup feels broad, noisy, and hard to steer.

## What The Simulated User Knows

- The operator wants upstream search output that can feed Idea Foundry with cleaner raw material.
- Current search themes blend regulated service pain, repetitive admin work, and generic "AI trends."
- The operator is unsure which sources actually produce credible early signals.
- Review happens inconsistently and mostly when the operator remembers to check results.

## Hidden Weaknesses

1. The prospecting objective is too broad across multiple sectors and job types.
2. The current search strategy confuses volume with quality and lacks a steering hypothesis.
3. Source selection is weak because it leans on generic web search and lightweight summaries.
4. Signal quality criteria do not distinguish recurring operational pain from one-off complaints.
5. Scan cadence is manual and unrealistic for sustained review.

## Critical Contradictions

1. The operator wants highly credible workflow pain signals but relies mostly on shallow sources.
2. The strategy claims to target fragmented service sectors, but the active themes are still too generic to govern.
3. The process is framed as continuous prospecting, yet no real review cadence or promotion rule exists.

## Revealable Facts

### fact_id: manual_search_only
- content: "Most of the current signal gathering still comes from manual web searches and a few saved forum tabs."
- reveal_conditions:
  - asks_about_source_mix
  - asks_which_sources_are_currently_used
- must_not_be_disclosed_before_turn: 2

### fact_id: weak_theme_pollution
- content: "One of the active themes is basically just 'AI automation opportunities,' which is probably too generic to be useful."
- reveal_conditions:
  - asks_about_search_themes
  - challenges_theme_specificity
- must_not_be_disclosed_before_turn: 3

### fact_id: no_promotion_rules
- content: "I do not have a clear rule for when a weak signal becomes worth promoting into a real idea candidate."
- reveal_conditions:
  - asks_about_signal_quality
  - asks_about_promotion_logic
- must_not_be_disclosed_before_turn: 4

### fact_id: review_cadence_drift
- content: "In practice I review results ad hoc, maybe once every couple of weeks, even though I wanted this to be an active prospecting loop."
- reveal_conditions:
  - asks_about_scan_cadence
  - asks_about_operating_rhythm
- must_not_be_disclosed_before_turn: 5

## Blocked Facts

- invented conversion benchmarks
- named private communities
- fabricated customer counts

## Ambiguity Policy

- The initial brief should sound plausible but under-structured.
- The simulated operator should not volunteer missing governance details unless asked directly.
- If the agent asks broad generic questions, answers should stay broad rather than supplying a better framework for the agent.

## Expected Strong Behaviors

- narrows the prospecting objective into a more governable target domain
- replaces generic search logic with explicit strategy patterns or lenses
- strengthens the source mix toward credible workflow pain sources
- removes or demotes weak generic themes
- defines signal quality criteria that separate repeated pain from noise
- proposes an operationally realistic scan cadence and a clear next best action

## Expected Failure Modes

- accepts broad multi-sector discovery without challenge
- treats generic AI themes as sufficient search direction
- recommends more searches without improving strategy logic
- leaves source mix as generic web search plus forums
- fails to define how signals should be filtered or promoted
