---
title: Scoring Model
category: algorithms
tags: [scoring, dimensions, weights, composite-score]
summary: How octotest computes per-invariant and project-wide test health scores from six weighted dimensions.
last-modified-by: user
---

## Composite score

Each invariant receives a score from 0-100, computed as a weighted sum of six dimensions. Scores roll up hierarchically: invariants → categories → project-wide.

## Dimensions

### Coverage (25%)

Does any test reference this invariant? Binary — either evidence exists in test files matching the `claim-evidence.yaml` patterns, or it doesn't. 0 or 100.

### Seed diversity (15%)

How many distinct scenarios exercise this invariant? Counts unique `it()`/`test()` blocks whose body matches the evidence patterns. A single test case scores low; multiple seeds/scenarios score high.

### Assertion strength (20%)

Does the test assert on this invariant's specific output, or just run the code? Measured as the ratio of explicit assertions (`expect(...).toBe(...)`) to bare function calls within matching test blocks. Static heuristic in phase 1; refined by LLM judgment in phase 2.

### Diagnostic depth (15%)

Is there a granular unit test backing the integration test? Checks whether evidence exists in both integration and unit test directories. Having only integration tests means failures are hard to localize. Having both scores highest.

### Oracle quality (15%)

Is the test checking behavior (derived from the spec) or just snapshotting current output? This dimension requires LLM judgment — it examines whether assertion values are meaningful (e.g., `expect(violations.noRoadOnWater).toBe(0)`) vs arbitrary (e.g., `expect(result).toMatchSnapshot()`).

**Without LLM pass:** This dimension scores as "unknown" and its weight is redistributed proportionally across the other five dimensions.

### Freshness (10%)

Has the spec evolved since the test was last modified? Compares the last git commit touching the invariant's section in `invariants.md` or the wiki against the last commit touching the matching test file. A growing gap decays the score.

## Roll-up

Category scores are the weighted average of their invariant scores. The project-wide score is the weighted average of category scores. This gives the tree visualization its color at every level — red at the top means problems somewhere below, and you drill down to find them.
