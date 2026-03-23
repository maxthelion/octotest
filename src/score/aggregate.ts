import type { DimensionScores, InvariantScore, CategoryScore } from "../types";

const WEIGHTS = {
  coverage: 0.25,
  seedDiversity: 0.15,
  assertionStrength: 0.2,
  diagnosticDepth: 0.15,
  oracleQuality: 0.15,
  freshness: 0.1,
};

/**
 * Compute the composite score for an invariant from its dimension scores.
 *
 * If oracleQuality is null (no LLM pass), redistribute its weight
 * proportionally across the other dimensions. If freshness is null
 * (no git history), similarly exclude it.
 */
export function computeComposite(dimensions: DimensionScores): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const value = dimensions[key as keyof DimensionScores];
    if (value === null) continue;
    totalWeight += weight;
    weightedSum += value * weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Group invariant scores by category and compute category averages.
 */
export function aggregateCategories(scores: InvariantScore[]): CategoryScore[] {
  const grouped = new Map<string, InvariantScore[]>();

  for (const score of scores) {
    const cat = score.claim.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(score);
  }

  const categories: CategoryScore[] = [];
  for (const [name, invariants] of grouped) {
    const avg =
      invariants.length > 0
        ? Math.round(invariants.reduce((sum, s) => sum + s.composite, 0) / invariants.length)
        : 0;

    categories.push({ name, score: avg, invariants });
  }

  // Sort by score ascending (worst first)
  categories.sort((a, b) => a.score - b.score);

  return categories;
}

/**
 * Compute the project-wide score as the average of category scores.
 */
export function computeProjectScore(categories: CategoryScore[]): number {
  if (categories.length === 0) return 0;
  return Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );
}
