# octotest

Test health diagnostics for spec-driven projects. Grades your test suite against spec-derived invariants.

## Usage

```bash
# Phase 1: Static analysis → JSON report
bun run cli.ts scan --project /path/to/project

# Generate HTML report from JSON
bun run cli.ts report
```

Requires `.shoe-makers/invariants.md` and `.shoe-makers/claim-evidence.yaml` in the target project.

## Shoe-makers integration

```typescript
import { getTestHealthResult } from "octotest/src/integrations/shoe-makers";
const testHealth = getTestHealthResult(projectRoot);
```
