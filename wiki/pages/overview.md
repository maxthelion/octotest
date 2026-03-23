---
title: Overview
category: architecture
tags: [overview, purpose, value-proposition]
summary: What octotest is, why it exists, and how it fits into the octoclean/octowiki/shoe-makers ecosystem.
last-modified-by: user
---

## What is octotest?

Octotest is a CLI diagnostic tool that grades a project's test suite against its spec-derived invariants. It answers the question: **"How well do your tests verify what your project is supposed to do?"**

This is fundamentally different from code coverage. Coverage tools tell you what code ran. Octotest tells you what **specified behavior** is verified, and how well. The spec is the oracle, and octotest measures how much of that oracle your tests actually use.

## Why it exists

The testing philosophy document ([[testing-philosophy]]) identifies a key insight: agents are collapsing the cost of high-signal testing techniques (integration tests, fuzz testing, matrix testing), but the remaining hard problem is the **oracle** — knowing what correct behavior looks like.

If your project has well-specified invariants (falsifiable claims about system behavior, maintained in a wiki via [[ref:doc:octowiki]]), you already have a candidate oracle. Octotest makes that oracle actionable by measuring the gap between what the spec says and what the tests verify.

## How it fits into the ecosystem

Octotest is one of three diagnostic tools that feed into [[ref:doc:shoe-makers]]:

- **[[ref:doc:octoclean]]** answers: "How healthy is this code?" (complexity, duplication, coverage, churn)
- **Octotest** answers: "How well do the tests verify the spec?" (invariant coverage, oracle quality, test strategy)
- **[[ref:doc:octowiki]]** provides the spec layer that both tools grade against

Shoe-makers' behaviour tree consumes octotest's output during its assessment phase, alongside octoclean's health score. The explore/prioritise phases can then surface test quality issues as work candidates for the elves to act on.

## How a human derives value

1. **Run `octotest scan`** in your project root — produces `octotest-report.json` with scores for every invariant
2. **Run phase 2** (via a Claude Code subagent) to enrich the report with LLM judgment and generate `octotest-report.html`
3. **Open the HTML report** — see a tree view of your invariants, color-coded by test health
4. **Drill down** from category level (bitmap, polyline, block) to individual invariants to see which are well-tested, weakly-tested, or untested
5. **Understand the gaps** — not just "this isn't tested" but "this is tested with only one seed" or "this test doesn't assert on the actual invariant output"
6. **Prioritise** — the scores tell you where additional testing effort has the highest marginal value

The report is a snapshot. Run it periodically (or let shoe-makers run it) to track how test quality evolves alongside the spec.
