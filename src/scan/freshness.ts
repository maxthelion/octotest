import { execSync } from "child_process";

/**
 * Freshness: has the spec evolved since the test was last modified?
 *
 * Compares last git commit touching the invariant's spec file vs
 * last commit touching any matching test file.
 *
 * Linear decay: 100 to 0 over 90 days.
 * If test is newer than spec → 100 (fresh).
 * No git history → null (excluded from scoring).
 */
export function scoreFreshness(
  specFile: string,
  testFiles: string[],
  projectRoot: string
): { score: number | null; lastSpecCommit: string | null; lastTestCommit: string | null } {
  const specDate = getLastCommitDate(specFile, projectRoot);
  if (!specDate) return { score: null, lastSpecCommit: null, lastTestCommit: null };

  if (testFiles.length === 0) {
    return { score: 0, lastSpecCommit: specDate.toISOString(), lastTestCommit: null };
  }

  // Find the most recent test file commit
  let latestTestDate: Date | null = null;
  for (const file of testFiles) {
    const date = getLastCommitDate(file, projectRoot);
    if (date && (!latestTestDate || date > latestTestDate)) {
      latestTestDate = date;
    }
  }

  if (!latestTestDate) {
    return { score: 0, lastSpecCommit: specDate.toISOString(), lastTestCommit: null };
  }

  // If test is newer than spec, it's fresh
  if (latestTestDate >= specDate) {
    return {
      score: 100,
      lastSpecCommit: specDate.toISOString(),
      lastTestCommit: latestTestDate.toISOString(),
    };
  }

  // Linear decay over 90 days
  const gapMs = specDate.getTime() - latestTestDate.getTime();
  const gapDays = gapMs / (1000 * 60 * 60 * 24);
  const score = Math.max(0, Math.round(100 - (gapDays / 90) * 100));

  return {
    score,
    lastSpecCommit: specDate.toISOString(),
    lastTestCommit: latestTestDate.toISOString(),
  };
}

function getLastCommitDate(filePath: string, cwd: string): Date | null {
  try {
    const output = execSync(`git log -1 --format=%aI -- "${filePath}"`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!output) return null;
    return new Date(output);
  } catch {
    return null;
  }
}
