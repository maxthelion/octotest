---
name: test-quality
description: Improve test coverage and quality for spec-derived invariants based on octotest analysis.
maps-to: test-quality
risk: medium
---

## When to apply

The octotest assessment shows invariants with low test health scores. Specifically:

- Invariants with `coverage: 0` (untested spec claims)
- Invariants with low `seedDiversity` (tested with only one scenario)
- Invariants with low `assertionStrength` (tests run code but don't assert on invariant outputs)
- Invariants with low `diagnosticDepth` (integration test exists but no unit-level test for diagnosis)

## Instructions

1. Read the work item to identify which invariant(s) to improve.
2. Read the invariant's claim text in `.shoe-makers/invariants.md` to understand what the spec requires.
3. Read the evidence patterns in `.shoe-makers/claim-evidence.yaml` to understand what code implements this invariant.
4. Check the weakest dimension:
   - **coverage = 0**: Write a new test that exercises this invariant and asserts on its output.
   - **seedDiversity low**: Add test cases with different seeds, inputs, or scenarios that exercise the same invariant under different conditions.
   - **assertionStrength low**: Strengthen existing assertions — replace `toBeDefined()` or `toMatchSnapshot()` with specific behavioral assertions derived from the spec claim.
   - **diagnosticDepth low**: If only an integration test exists, add a focused unit test for the specific check function. If only unit tests exist, add an integration test that runs the full pipeline.
5. Run `bun test` after each change.
6. Verify the change is meaningful — the test should fail if the invariant is violated.

## Verification criteria

- `bun test` passes
- New/modified tests assert on behavior described by the invariant claim
- Tests fail when the invariant is intentionally violated (if safe to verify)
- No snapshot-based assertions for invariant outputs

## Permitted actions

- Create new test files in `test/`
- Add test cases to existing test files
- Strengthen assertions in existing tests
- Add test fixtures and seed data

## Off-limits

- Do not modify source code (this skill is for tests only)
- Do not modify `.shoe-makers/invariants.md` or `claim-evidence.yaml`
- Do not weaken or remove existing assertions
- Do not add tests that only assert current output without understanding the spec (no regression-only tests)
