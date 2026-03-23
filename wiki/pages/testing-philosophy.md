---
title: Testing Philosophy
category: decisions
tags: [testing, philosophy, oracle-problem, agents, integration-tests]
summary: The foundational thinking behind octotest — agents reduce testing costs, the oracle problem remains, specs-as-oracles is the key insight.
last-modified-by: user
---

## Core thesis

Agents are collapsing the cost of high-signal testing techniques. Integration tests, matrix testing, fuzz testing, property-based testing — all were historically rate-limited by human attention cost, not by their value. As that cost drops, the optimal testing strategy shifts.

## The oracle problem

The residual hard problem is knowing what correct behavior looks like. An agent can generate tests fluently, but if the expected outputs are wrong or underspecified, you get a fast cheap suite that gives false confidence.

A test has two parts: running the code under test, and asserting something about the result. The **oracle** is the thing that tells you what to assert. For simple cases it's obvious (sorting, arithmetic). It becomes non-trivial when:

- The correct output is complex, context-dependent, or probabilistic
- The system makes judgments rather than computing deterministic answers
- The expected behavior isn't fully specified anywhere

## Specs as oracles

If documentation is the authoritative spec — maintained as falsifiable invariants in a wiki — you have a candidate oracle. This is the foundation octotest builds on. The spec says what the system should do. The tests should verify those claims. Octotest measures the gap.

## Key design decisions this drives

1. **Invariants as the unit of analysis** — not files, not functions, not lines. Each falsifiable claim from the spec is what gets scored.
2. **Spec-awareness over coverage** — traditional coverage is a proxy. Octotest measures the real thing: does the test suite verify specified behavior?
3. **Diagnostic, not generative** — octotest identifies gaps but doesn't fill them. The oracle problem means test generation requires judgment; that's the executor's job (shoe-makers' elves), not the diagnostic tool's.

## Source

See `testingphilosophy.md` in the project root for the full conversation that developed this thinking.
