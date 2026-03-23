import { resolve, join } from "path";
import { existsSync } from "fs";
import { scan } from "../scan/index";
import { aggregateCategories, computeProjectScore } from "../score/aggregate";

/**
 * Shoe-makers integration: returns test health data in the format
 * expected by shoe-makers' assessment.json.
 *
 * Usage in shoe-makers assess():
 *   import { getTestHealthResult } from "octotest/src/integrations/shoe-makers";
 *   const testHealth = getTestHealthResult(projectRoot);
 *   // → { score, categoryScores, worstInvariants } | null
 */
export interface TestHealthResult {
  score: number;
  categoryScores: Record<string, number>;
  worstInvariants: Array<{
    id: string;
    claim: string;
    score: number;
    weakestDimension: string;
  }>;
}

export function getTestHealthResult(projectRoot: string): TestHealthResult | null {
  const absRoot = resolve(projectRoot);
  const invariantsPath = join(absRoot, ".shoe-makers", "invariants.md");
  const evidencePath = join(absRoot, ".shoe-makers", "claim-evidence.yaml");

  if (!existsSync(invariantsPath) || !existsSync(evidencePath)) {
    return null;
  }

  try {
    const scores = scan(absRoot);
    const categories = aggregateCategories(scores);
    const projectScore = computeProjectScore(categories);

    // Category scores map
    const categoryScores: Record<string, number> = {};
    for (const cat of categories) {
      categoryScores[cat.name] = cat.score;
    }

    // Worst invariants (lowest composite among those with any coverage)
    const allInvariants = categories.flatMap((c) => c.invariants);
    const covered = allInvariants.filter((i) => i.dimensions.coverage > 0);
    const uncovered = allInvariants.filter((i) => i.dimensions.coverage === 0);

    // Take worst 5 covered + worst 5 uncovered
    const worstCovered = [...covered]
      .sort((a, b) => a.composite - b.composite)
      .slice(0, 5);
    const worstUncovered = uncovered.slice(0, 5);

    const worstInvariants = [...worstCovered, ...worstUncovered]
      .sort((a, b) => a.composite - b.composite)
      .slice(0, 10)
      .map((inv) => ({
        id: inv.claim.id,
        claim: inv.claim.text,
        score: inv.composite,
        weakestDimension: findWeakestDimension(inv.dimensions),
      }));

    return {
      score: projectScore,
      categoryScores,
      worstInvariants,
    };
  } catch (err) {
    console.error("octotest scan failed:", err);
    return null;
  }
}

function findWeakestDimension(dims: Record<string, number | null>): string {
  let weakest = "";
  let lowest = Infinity;

  const entries: [string, number | null][] = [
    ["coverage", dims.coverage],
    ["seedDiversity", dims.seedDiversity],
    ["assertionStrength", dims.assertionStrength],
    ["diagnosticDepth", dims.diagnosticDepth],
    ["freshness", dims.freshness],
  ];

  for (const [name, value] of entries) {
    if (value !== null && value < lowest) {
      lowest = value;
      weakest = name;
    }
  }

  return weakest;
}
