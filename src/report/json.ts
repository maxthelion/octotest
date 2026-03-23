import { writeFileSync } from "fs";
import type { OctotestReport, CategoryScore } from "../types";

/**
 * Build the full report object and write it to disk as JSON.
 */
export function writeReport(
  categories: CategoryScore[],
  projectScore: number,
  outputPath: string
): OctotestReport {
  let invariantCount = 0;
  let coveredCount = 0;
  let untestedCount = 0;

  for (const cat of categories) {
    for (const inv of cat.invariants) {
      invariantCount++;
      if (inv.dimensions.coverage > 0) {
        coveredCount++;
      } else {
        untestedCount++;
      }
    }
  }

  const report: OctotestReport = {
    version: 1,
    timestamp: new Date().toISOString(),
    projectScore,
    categories,
    meta: {
      llmEnriched: false,
      invariantCount,
      coveredCount,
      untestedCount,
    },
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  return report;
}
