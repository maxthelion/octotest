/**
 * Diagnostic depth: is there a granular unit test backing the integration test?
 *
 * Uses path-based heuristics:
 *   - Paths containing "integration" or "e2e" → integration tests
 *   - All other test files → unit tests
 *
 * Scoring:
 *   Both unit + integration evidence = 100
 *   Integration only = 40
 *   Unit only = 60
 *   Neither = 0
 */
export function scoreDiagnosticDepth(testFiles: string[]): number {
  if (testFiles.length === 0) return 0;

  let hasIntegration = false;
  let hasUnit = false;

  for (const file of testFiles) {
    const lower = file.toLowerCase();
    if (lower.includes("integration") || lower.includes("e2e")) {
      hasIntegration = true;
    } else {
      hasUnit = true;
    }
  }

  if (hasUnit && hasIntegration) return 100;
  if (hasUnit) return 60;
  if (hasIntegration) return 40;
  return 0;
}
