---
title: Shoe-makers Integration
category: architecture
tags: [shoe-makers, behaviour-tree, assessment, elves]
summary: How octotest integrates with shoe-makers' behaviour tree as a diagnostic data source during the assessment phase.
last-modified-by: user
---

## Role

Octotest is a diagnostic instrument, not an actor. It produces structured data that [[ref:doc:shoe-makers]] consumes through its existing assess → explore → prioritise → execute flow. It does not write tests itself.

## Assessment phase integration

Shoe-makers' `assess()` function already calls octoclean for code health. Octotest would be called alongside it:

```
assess()
├── checkInvariants()
├── runTests()
├── runTypecheck()
├── getHealthResult()       ← octoclean
├── getTestHealthResult()   ← octotest scan (phase 1 only)
└── writes assessment.json
```

The `assessment.json` blackboard would gain test health fields:

```typescript
interface Assessment {
  // ... existing fields ...
  testHealth: {
    score: number;                    // 0-100 project-wide
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

## Behaviour tree consumption

The explore and prioritise phases already reason about the assessment to find work candidates. With test health data available, they can surface candidates like:

- "Invariant `noRoadOnWater` has coverage but only 1 seed — add seed diversity"
- "Block invariants category scores 35 — multiple invariants untested"
- "Invariant `staleEdgeRefs` test hasn't been updated since spec change 2 weeks ago"

A new skill (`test-quality.md`) in `.shoe-makers/skills/` would guide the executor elf when the prioritiser picks a test quality candidate.

## Relationship to octowiki-invariants

The existing octowiki-invariants skill does a simpler version of spec-vs-code coverage checking. Over time, octotest supersedes some of that functionality — specifically the "is this invariant tested?" analysis. The octowiki-invariants skill may narrow its scope to spec-vs-implementation (is the invariant *implemented*), while octotest handles the testing dimension.
