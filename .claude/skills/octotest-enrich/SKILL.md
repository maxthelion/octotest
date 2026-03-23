---
name: octotest-enrich
description: Enrich an octotest JSON report with LLM judgment (oracle quality + assertion strength) and generate HTML report
---

# Octotest Phase 2: LLM Enrichment

You are enriching an octotest report with qualitative analysis that static analysis cannot provide.

## Input

Read `octotest-report.json` in the project root (or the path specified by the user).

## What to do

For each invariant that has `dimensions.coverage > 0` (i.e., has test evidence):

### 1. Score Oracle Quality (0-100)

Read the `snippets` array — these are the actual test code blocks. Evaluate:

- **100**: Test assertions are clearly derived from the spec. They check behavioral correctness (e.g., `expect(violations.noRoadOnWater).toBe(0)` — the spec says no roads on water, the test verifies that).
- **70-99**: Assertions check meaningful properties but aren't directly traceable to a specific spec claim.
- **40-69**: Assertions exist but are weak — checking types, truthiness, or that code runs without error rather than checking correctness.
- **10-39**: Tests are essentially regression snapshots — `toMatchSnapshot()`, `toMatchInlineSnapshot()`, or asserting on arbitrary values that just happen to be the current output.
- **0**: No meaningful assertions despite the test existing.

Set `dimensions.oracleQuality` to your score.

### 2. Refine Assertion Strength

The static heuristic counts assertion-to-line ratios. Review the snippets and adjust `dimensions.assertionStrength` if the heuristic is misleading:

- **Increase** if assertions are few but each is highly targeted and meaningful
- **Decrease** if assertions are numerous but trivial (e.g., many `toBeDefined()` checks)
- **Leave unchanged** if the heuristic seems reasonable

### 3. Recalculate Composites

After updating dimensions, recalculate the `composite` score using these weights:
- Coverage: 25%
- Seed Diversity: 15%
- Assertion Strength: 20%
- Diagnostic Depth: 15%
- Oracle Quality: 15%
- Freshness: 10%

Also recalculate category scores (average of invariant composites) and the project score (average of category scores).

### 4. Set Metadata

Set `meta.llmEnriched` to `true`.

## Output

1. Write the enriched JSON back to `octotest-report.json`
2. Run `bun /path/to/octotest/cli.ts report` to generate the HTML report
3. Report the project score and a brief summary of findings
