import type { EvidenceRule, ScanContext } from "../types";
import { findMatchingFiles } from "./match";

/**
 * Coverage: does any test file match this invariant's test patterns?
 * Binary score: 0 (no test) or 100 (at least one test).
 *
 * Returns matching test files as evidence.
 */
export function scoreCoverage(
  rule: EvidenceRule,
  ctx: ScanContext,
  contentCache: Map<string, string>
): { score: number; testFiles: string[] } {
  const testFiles = findMatchingFiles(ctx.testFiles, rule.testPatterns, contentCache);
  return {
    score: testFiles.length > 0 ? 100 : 0,
    testFiles,
  };
}
