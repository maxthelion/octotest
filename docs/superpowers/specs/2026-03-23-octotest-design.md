# Octotest Design Spec

## What it is

Octotest is a CLI diagnostic tool that grades a project's test suite against its spec-derived invariants. It answers: "How well do your tests verify what your project is supposed to do?"

Unlike code coverage tools (which measure what code ran), octotest measures what **specified behavior** is verified. The spec is the oracle; octotest measures how much of that oracle the tests actually use.

## Ecosystem context

Octotest is one of three diagnostic tools feeding shoe-makers' behaviour tree:

- **Octoclean** — "How healthy is this code?" (complexity, duplication, coverage, churn)
- **Octotest** — "How well do the tests verify the spec?" (invariant coverage, oracle quality, test strategy)
- **Octowiki** — provides the spec layer both tools grade against

Octotest is a diagnostic instrument, not an actor. It produces structured data that shoe-makers consumes through its assess → explore → prioritise → execute flow. It does not write tests.

## Stack

TypeScript on Bun. Consistent with octoclean, shoe-makers, octowiki.

## Two-phase operation

### Phase 1: Static analysis (`octotest scan`)

Deterministic CLI command. No API keys, no network calls.

**Inputs:**
- `.shoe-makers/invariants.md` — falsifiable claims, grouped by `##` headings
- `.shoe-makers/claim-evidence.yaml` — patterns mapping claims to source/test files
- Test files (`.test.ts`, `.spec.ts`) — scanned via evidence patterns
- Git history — for freshness comparison

**Steps:**
1. Parse invariants — extract claims, assign IDs from section + position
2. Resolve evidence — read `claim-evidence.yaml`, match claims to `test:` patterns
3. Score each invariant across 5 static dimensions (see Scoring Model)
4. Aggregate — roll up into per-category and project-wide scores
5. Write `octotest-report.json`

The JSON includes the full score tree plus metadata for phase 2: which claims need qualitative assessment and relevant test source snippets.

### Phase 2: LLM-enriched analysis (subagent)

Run by a Claude Code subagent, not by the CLI. No API key required.

**Inputs:** `octotest-report.json` from phase 1

**Enrichments:**
- Assertion strength — refines the static heuristic with judgment about whether assertions are meaningful
- Oracle quality — scores whether tests check spec-derived behavior vs snapshotted output

**Outputs:**
- Enriched `octotest-report.json` with all six dimensions scored
- `octotest-report.html` — static HTML report with tree-drilldown visualization

## Scoring model

Each invariant gets a composite score (0-100) from six weighted dimensions:

| Dimension | What it measures | Phase | Weight |
|---|---|---|---|
| Coverage | Does any test reference this invariant? | Static | 25% |
| Seed diversity | How many distinct scenarios exercise it? | Static | 15% |
| Assertion strength | Explicit assertions vs bare function calls? | Static + LLM | 20% |
| Diagnostic depth | Unit tests backing integration tests? | Static | 15% |
| Oracle quality | Behavior checks vs snapshot regression? | LLM | 15% |
| Freshness | Spec evolved since test last modified? | Static (git) | 10% |

**Seed diversity scale:** 1 test case = 20, 2 = 50, 3 = 75, 4 = 90, 5+ = 100. Logarithmic — diminishing returns past 3-4 scenarios.

**Freshness decay:** Linear decay from 100 to 0 over 90 days, measured as the gap between the last git commit touching the invariant's spec section and the last commit touching the matching test file. If the test was modified more recently than the spec, freshness = 100. No git history = freshness excluded from scoring.

**Assertion strength (phase interaction):** Phase 1 produces a static heuristic score. Phase 2 may adjust it (up or down) based on LLM judgment. The composite score is recalculated after phase 2 adjustments, so the JSON `composite` value may differ between phase 1 and phase 2 outputs. The `meta.llmEnriched` flag distinguishes them.

**Diagnostic depth:** Uses path-based heuristics to classify test files — paths containing `integration` or `e2e` are integration tests; all other test files are unit tests. Scoring: evidence in both = 100, integration only = 40, unit only = 60, neither = 0.

**Roll-up:** Invariants → categories → project-wide. Simple averages at each level (all invariants weighted equally within a category, all categories weighted equally).

**Without LLM pass:** Oracle quality scores as "unknown" and its weight redistributes proportionally across the other five dimensions. Assertion strength retains its static heuristic score.

## Data model

```typescript
interface Claim {
  id: string;              // e.g. "bitmap.1"
  text: string;            // The falsifiable claim
  category: string;        // The ## heading
}

// Maps to claim-evidence.yaml entries like:
//   bitmap.noRoadOnWater:
//     source:
//       - [checkAllBitmapInvariants]
//     test:
//       - [noRoadOnWater]
interface EvidenceRule {
  claimId: string;
  sourcePatterns: string[];   // Substring patterns matched against source files
  testPatterns: string[];     // Substring patterns matched against test files
}

interface InvariantScore {
  claim: Claim;
  composite: number;          // 0-100 weighted
  dimensions: {
    coverage: number;         // 0 or 100
    seedDiversity: number;    // 0-100
    assertionStrength: number; // 0-100
    diagnosticDepth: number;  // 0-100
    freshness: number;        // 0-100
    oracleQuality: number | null; // null = needs LLM
  };
  evidence: {
    testFiles: string[];
    assertionCount: number;
    testCaseCount: number;
    lastSpecCommit: string;
    lastTestCommit: string;
  };
  snippets: string[];         // Test excerpts for LLM pass
}

interface OctotestReport {
  version: 1;
  timestamp: string;
  projectScore: number;
  categories: Array<{
    name: string;
    score: number;
    invariants: InvariantScore[];
  }>;
  meta: {
    llmEnriched: boolean;
    invariantCount: number;
    coveredCount: number;
    untestedCount: number;
  };
}
```

## HTML report

Single self-contained `.html` file (embedded CSS/JS). Generated by the subagent in phase 2.

**Layout:**
- **Header** — project name, overall score (large, color-coded), timestamp
- **Tree view** (main area) — collapsible hierarchy:
  - Category level — name + aggregate score badge, colored bar showing invariant distribution (green/amber/red)
  - Invariant level — claim text + composite score + mini bar chart of 6 dimensions
  - Evidence level — test files, assertions, seed count, freshness date
- **Summary sidebar** — worst 5 invariants, dimension breakdown chart, quick stats (total invariants, % covered, % LLM-assessed)

Green (80-100), amber (50-79), red (0-49). Static HTML, works offline.

## Project structure

```
octotest/
├── src/
│   ├── cli/
│   │   └── index.ts              # CLI entry: `octotest scan`
│   ├── parse/
│   │   ├── invariants.ts         # Parse invariants.md → claims
│   │   └── evidence.ts           # Parse claim-evidence.yaml → patterns
│   ├── scan/
│   │   ├── coverage.ts           # Binary coverage check
│   │   ├── seed-diversity.ts     # Count test cases per invariant
│   │   ├── assertion-strength.ts # Assertion ratio heuristic
│   │   ├── diagnostic-depth.ts   # Integration + unit check
│   │   └── freshness.ts          # Git date comparison
│   ├── score/
│   │   └── aggregate.ts          # Weighted roll-up
│   └── report/
│       └── json.ts               # Write octotest-report.json
├── wiki/                         # Octowiki pages
├── cli.ts                        # Bun shebang entry point
├── package.json
└── tsconfig.json
```

HTML generation is the subagent's responsibility, not part of the CLI.

## Shoe-makers integration

Fits into the assessment phase alongside octoclean:

```
assess()
├── checkInvariants()
├── runTests()
├── runTypecheck()
├── getHealthResult()       ← octoclean
├── getTestHealthResult()   ← octotest scan (phase 1)
└── writes assessment.json
```

Assessment gains test health fields:

```typescript
interface Assessment {
  // ... existing ...
  testHealth: {
    score: number;
    categoryScores: Record<string, number>;
    worstInvariants: Array<{
      id: string;
      claim: string;
      score: number;
      weakestDimension: string;
    }>;
  } | null;
}
```

Explore/prioritise elves see this data and can surface test quality candidates. A `test-quality.md` skill in `.shoe-makers/skills/` guides executors.

## What it does NOT do

- Does not write or generate tests (that's the executor's job)
- Does not call the Anthropic API directly (LLM reasoning comes from the subagent)
- Does not run tests (it analyzes the test code, not test results)
- Does not replace octowiki-invariants entirely — that skill retains spec-vs-implementation checking; octotest handles the testing dimension
