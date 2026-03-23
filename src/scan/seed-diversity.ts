import type { EvidenceRule, ScanContext } from "../types";
import { getContent, matchesAnyPatternGroup } from "./match";

/**
 * Seed diversity: how many distinct test cases exercise this invariant?
 *
 * Counts unique it()/test() blocks whose body matches the evidence patterns.
 *
 * Scale (logarithmic, diminishing returns):
 *   1 test = 20
 *   2 tests = 50
 *   3 tests = 75
 *   4 tests = 90
 *   5+ tests = 100
 */
const DIVERSITY_SCALE: Record<number, number> = {
  0: 0,
  1: 20,
  2: 50,
  3: 75,
  4: 90,
};

export function scoreSeedDiversity(
  rule: EvidenceRule,
  testFiles: string[],
  ctx: ScanContext,
  contentCache: Map<string, string>
): { score: number; testCaseCount: number } {
  if (testFiles.length === 0) return { score: 0, testCaseCount: 0 };
  if (rule.testPatterns.length === 0) return { score: 0, testCaseCount: 0 };

  let totalCases = 0;

  for (const file of testFiles) {
    const content = getContent(file, contentCache);
    const blocks = extractTestBlocks(content);

    for (const block of blocks) {
      if (matchesAnyPatternGroup(block.body, rule.testPatterns)) {
        totalCases++;
      }
    }
  }

  const score = totalCases >= 5 ? 100 : (DIVERSITY_SCALE[totalCases] ?? 0);
  return { score, testCaseCount: totalCases };
}

interface TestBlock {
  name: string;
  body: string;
}

/**
 * Extract test blocks (it/test calls) from a test file.
 * Uses a simple brace-counting parser.
 */
function extractTestBlocks(content: string): TestBlock[] {
  const blocks: TestBlock[] = [];
  // Match it("..." or test("..." at the start of a statement
  const testRegex = /(?:^|\n)\s*(?:it|test)\s*\(\s*["'`]([^"'`]*)["'`]/g;

  let match: RegExpExecArray | null;
  while ((match = testRegex.exec(content)) !== null) {
    const name = match[1];
    const startIndex = match.index + match[0].length;

    // Find the body by counting braces from the first { after the match
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

    blocks.push({
      name,
      body: content.slice(braceStart, end + 1),
    });
  }

  return blocks;
}
