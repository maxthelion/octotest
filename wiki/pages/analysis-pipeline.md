---
title: Analysis Pipeline
category: pipeline
tags: [static-analysis, two-phase, cli, json, html]
summary: The two-phase analysis pipeline — static analysis producing JSON, optional LLM pass producing the HTML report.
last-modified-by: user
---

## Two-phase design

Octotest operates in two phases. Phase 1 always runs and produces useful output. Phase 2 is optional and additive.

### Phase 1: Static analysis (`octotest scan`)

A deterministic CLI command. No API keys, no network calls.

**Inputs:**
- `.shoe-makers/invariants.md` — the falsifiable claims, grouped by `##` headings
- `.shoe-makers/claim-evidence.yaml` — patterns mapping claims to source and test files
- Test files (`.test.ts`, `.spec.ts`) — scanned via evidence patterns
- Git history — for freshness comparison

**Steps:**
1. **Parse invariants** — extract claims from `invariants.md`, assign each an ID from its section + position
2. **Resolve evidence** — read `claim-evidence.yaml`, match each claim to its `test:` patterns
3. **Score each invariant** — compute Coverage, Seed diversity, Assertion strength (heuristic), Diagnostic depth, and Freshness per the [[scoring-model]]
4. **Aggregate** — roll up into per-category and project-wide scores
5. **Write output** — `octotest-report.json`

The JSON includes the full score tree plus metadata for phase 2: which claims need qualitative assessment and the relevant test source snippets.

### Phase 2: LLM-enriched analysis (subagent)

Run by a Claude Code subagent, not by the CLI directly. This means no API key is required — the subagent provides the LLM reasoning.

**Inputs:**
- `octotest-report.json` from phase 1

**Enrichments:**
- **Assertion strength** — refines the static heuristic with judgment about whether assertions are meaningful
- **Oracle quality** — scores whether tests check spec-derived behavior vs snapshotted output

**Outputs:**
- Enriched `octotest-report.json` with all six dimensions scored
- `octotest-report.html` — static HTML report with tree-drilldown visualization

## Shoe-makers integration

In shoe-makers' behaviour tree, octotest fits into the [[ref:doc:shoe-makers]] assessment phase. `assess()` calls `octotest scan` (phase 1 only), and the JSON output is stored in `assessment.json` alongside octoclean's health score. The explore/prioritise phases then have test health data to reason about.

Phase 2 is not run inside the behaviour tree — it's for human-facing reports.
