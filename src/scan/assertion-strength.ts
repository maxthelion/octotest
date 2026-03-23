import type { EvidenceRule, ScanContext } from "../types";
import { getContent, matchesAnyPatternGroup } from "./match";

/**
 * Assertion strength: ratio of explicit assertions to bare function calls
 * within test blocks that match this invariant's evidence patterns.
 *
 * Heuristic (phase 1 only, LLM refines in phase 2):
 *   - Count lines with expect/assert/should patterns
 *   - Count total non-blank lines in matching test blocks
 *   - Score = (assertionLines / totalLines) * 100, capped at 100
 *
 * A test block with lots of assertions relative to setup = high score.
 * A test block that mostly runs code with a single assertion = low score.
 */
export function scoreAssertionStrength(
  rule: EvidenceRule,
  testFiles: string[],
  contentCache: Map<string, string>
): { score: number; assertionCount: number; snippets: string[] } {
  if (testFiles.length === 0) return { score: 0, assertionCount: 0, snippets: [] };
  if (rule.testPatterns.length === 0) return { score: 0, assertionCount: 0, snippets: [] };

  let totalAssertions = 0;
  let totalLines = 0;
  const snippets: string[] = [];

  for (const file of testFiles) {
    const content = getContent(file, contentCache);
    const blocks = extractMatchingBlocks(content, rule.testPatterns);

    for (const block of blocks) {
      const lines = block.split("\n").filter((l) => l.trim().length > 0);
      const assertionLines = lines.filter(isAssertionLine);

      totalAssertions += assertionLines.length;
      totalLines += lines.length;

      // Collect snippets for LLM phase (truncate long blocks)
      if (block.length <= 2000) {
        snippets.push(block);
      } else {
        snippets.push(block.slice(0, 2000) + "\n// ... truncated");
      }
    }
  }

  if (totalLines === 0) return { score: 0, assertionCount: 0, snippets };

  // Ratio-based score: aim for ~20-30% assertion density as "good"
  // Scale so that 25% density = 100
  const ratio = totalAssertions / totalLines;
  const score = Math.min(100, Math.round(ratio * 400));

  return { score, assertionCount: totalAssertions, snippets };
}

function isAssertionLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.includes("expect(") ||
    trimmed.includes("assert(") ||
    trimmed.includes("assert.") ||
    trimmed.includes(".toBe(") ||
    trimmed.includes(".toEqual(") ||
    trimmed.includes(".toMatch") ||
    trimmed.includes(".toContain(") ||
    trimmed.includes(".toThrow") ||
    trimmed.includes(".toHaveLength(") ||
    trimmed.includes(".toBeTruthy") ||
    trimmed.includes(".toBeFalsy") ||
    trimmed.includes(".toBeNull") ||
    trimmed.includes(".toBeDefined") ||
    trimmed.includes(".toBeUndefined") ||
    trimmed.includes(".toBeGreaterThan") ||
    trimmed.includes(".toBeLessThan") ||
    trimmed.includes(".should.")
  );
}

/**
 * Extract test block bodies that match the given evidence patterns.
 */
function extractMatchingBlocks(content: string, testPatterns: string[][]): string[] {
  const blocks: string[] = [];
  const testRegex = /(?:^|\n)\s*(?:it|test)\s*\(\s*["'`]([^"'`]*)["'`]/g;

  let match: RegExpExecArray | null;
  while ((match = testRegex.exec(content)) !== null) {
    const startIndex = match.index + match[0].length;
    const braceStart = content.indexOf("{", startIndex);
    if (braceStart === -1) continue;

    let depth = 0;
    let end = braceStart;
    for (let i = braceStart; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    const body = content.slice(braceStart, end + 1);
    if (matchesAnyPatternGroup(body, testPatterns)) {
      blocks.push(body);
    }
  }

  return blocks;
}
