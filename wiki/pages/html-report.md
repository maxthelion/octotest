---
title: HTML Report
category: ui
tags: [report, visualization, tree-view, drill-down]
summary: The static HTML report with hierarchical tree visualization of test health scores.
last-modified-by: user
---

## Purpose

The HTML report is the primary way a human interacts with octotest's output. It presents the full invariant tree — project → category → invariant — with scores and color-coding at every level, allowing drill-down from a high-level overview to specific problem areas.

## Tree visualization

The primary view is a hierarchical tree, color-coded by score:

- **Green (80-100):** Well-tested invariant — good coverage, diverse scenarios, strong assertions
- **Amber (50-79):** Partially tested — exists but has gaps (low seed diversity, weak assertions, stale)
- **Red (0-49):** Poorly tested or untested — high risk area

At the top level, categories are shown with their aggregate score. Expanding a category shows its invariants. Expanding an invariant shows the individual dimension scores and the evidence (which test files, which assertions).

## Drill-down detail

When you expand an invariant, you see:

- The invariant's text (the falsifiable claim from the spec)
- The composite score and its breakdown across the six dimensions
- Which test files provide evidence (linked to source)
- Which seeds/scenarios are covered
- If LLM-enriched: qualitative notes on oracle quality and assertion strength

## Generation

The HTML report is generated during phase 2 (the subagent pass). It's a single self-contained `.html` file with embedded CSS and JS — no server needed, just open it in a browser.

Phase 1 (static analysis only) does not produce HTML — it produces `octotest-report.json` which can be consumed programmatically or fed to phase 2 for the visual report.
