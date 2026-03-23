import { globSync } from "fs";
import { join, resolve } from "path";
import type { Claim, EvidenceRule, InvariantScore, ScanContext } from "../types";
import { parseInvariants } from "../parse/invariants";
import { parseEvidence } from "../parse/evidence";
import { scoreCoverage } from "./coverage";
import { scoreSeedDiversity } from "./seed-diversity";
import { scoreAssertionStrength } from "./assertion-strength";
import { scoreDiagnosticDepth } from "./diagnostic-depth";
import { scoreFreshness } from "./freshness";
import { computeComposite } from "../score/aggregate";

/**
 * Run the full static analysis scan.
 *
 * 1. Parse invariants and evidence
 * 2. Discover test and source files
 * 3. Score each invariant across all dimensions
 * 4. Return scored invariants
 */
export function scan(projectRoot: string): InvariantScore[] {
  const absRoot = resolve(projectRoot);
  const invariantsPath = join(absRoot, ".shoe-makers", "invariants.md");
  const evidencePath = join(absRoot, ".shoe-makers", "claim-evidence.yaml");

  // Parse inputs
  const claims = parseInvariants(invariantsPath);
  const evidenceRules = parseEvidence(evidencePath);

  // Build a map from evidence claim IDs to rules
  const ruleMap = new Map<string, EvidenceRule>();
  for (const rule of evidenceRules) {
    ruleMap.set(rule.claimId, rule);
  }

  // Discover files
  const testFiles = findFiles(absRoot, ["**/*.test.ts", "**/*.spec.ts", "**/*.test.js", "**/*.spec.js"]);
  const sourceFiles = findFiles(absRoot, ["**/*.ts", "**/*.js"]).filter(
    (f) => !f.includes(".test.") && !f.includes(".spec.") && !f.includes("node_modules")
  );

  const ctx: ScanContext = {
    projectRoot: absRoot,
    invariantsPath,
    evidencePath,
    testFiles,
    sourceFiles,
  };

  // Content cache to avoid re-reading files
  const contentCache = new Map<string, string>();

  // Build claim-to-rule mapping
  const claimRuleMap = buildClaimToRuleMap(claims, evidenceRules, ruleMap);

  // Score each claim
  const scores: InvariantScore[] = [];

  for (const claim of claims) {
    const rule = claimRuleMap.get(claim.id) ?? null;

    if (!rule) {
      // No evidence rule for this claim — untested by definition
      scores.push(makeUntestedScore(claim));
      continue;
    }

    // Coverage
    const { score: coverageScore, testFiles: matchedTestFiles } = scoreCoverage(
      rule,
      ctx,
      contentCache
    );

    // Seed diversity
    const { score: diversityScore, testCaseCount } = scoreSeedDiversity(
      rule,
      matchedTestFiles,
      ctx,
      contentCache
    );

    // Assertion strength
    const { score: assertionScore, assertionCount, snippets } = scoreAssertionStrength(
      rule,
      matchedTestFiles,
      contentCache
    );

    // Diagnostic depth
    const depthScore = scoreDiagnosticDepth(matchedTestFiles);

    // Freshness
    const { score: freshnessScore, lastSpecCommit, lastTestCommit } = scoreFreshness(
      invariantsPath,
      matchedTestFiles,
      absRoot
    );

    const dimensions = {
      coverage: coverageScore,
      seedDiversity: diversityScore,
      assertionStrength: assertionScore,
      diagnosticDepth: depthScore,
      freshness: freshnessScore,
      oracleQuality: null, // Needs LLM pass
    };

    const composite = computeComposite(dimensions);

    scores.push({
      claim,
      composite,
      dimensions,
      evidence: {
        testFiles: matchedTestFiles,
        assertionCount,
        testCaseCount,
        lastSpecCommit,
        lastTestCommit,
      },
      snippets,
    });
  }

  return scores;
}

/**
 * Build a lookup that maps each claim to its evidence rule.
 *
 * Strategy:
 * 1. Exact claim ID match (claim.id === rule.claimId)
 * 2. Prefix match: group evidence rules by their first N-1 dotted parts
 *    (e.g., "bitmap-invariants.exclusion-rules"), group claims by
 *    category+subcategory slug. Within a matching group, match by
 *    position (order in file) or by fuzzy text similarity.
 */
function buildClaimToRuleMap(
  claims: Claim[],
  allRules: EvidenceRule[],
  ruleMap: Map<string, EvidenceRule>
): Map<string, EvidenceRule> {
  const result = new Map<string, EvidenceRule>();
  const usedRules = new Set<string>();

  // Pass 1: exact ID match
  for (const claim of claims) {
    if (ruleMap.has(claim.id)) {
      result.set(claim.id, ruleMap.get(claim.id)!);
      usedRules.add(claim.id);
    }
  }

  // Pass 2: group rules by prefix, match to claim groups by position + text
  // Group evidence rules by prefix (all parts except the last)
  const rulesByPrefix = new Map<string, EvidenceRule[]>();
  for (const rule of allRules) {
    if (usedRules.has(rule.claimId)) continue;
    const parts = rule.claimId.split(".");
    if (parts.length < 2) continue;
    const prefix = parts.slice(0, -1).join(".");
    if (!rulesByPrefix.has(prefix)) rulesByPrefix.set(prefix, []);
    rulesByPrefix.get(prefix)!.push(rule);
  }

  // Group claims by category+subcategory slug
  const claimsByGroup = new Map<string, Claim[]>();
  for (const claim of claims) {
    if (result.has(claim.id)) continue;
    const catSlug = slugify(claim.category);
    const subSlug = claim.subcategory ? slugify(claim.subcategory) : null;
    const key = subSlug ? `${catSlug}.${subSlug}` : catSlug;
    if (!claimsByGroup.has(key)) claimsByGroup.set(key, []);
    claimsByGroup.get(key)!.push(claim);
  }

  // For each claim group, find a matching rule group
  for (const [claimPrefix, groupClaims] of claimsByGroup) {
    // Try exact prefix match first
    let matchingRules = rulesByPrefix.get(claimPrefix);

    // If no exact match, try matching just the last segment
    if (!matchingRules) {
      const lastSeg = claimPrefix.split(".").pop()!;
      for (const [rulePrefix, rules] of rulesByPrefix) {
        if (rulePrefix.endsWith(lastSeg) || rulePrefix.split(".").pop() === lastSeg) {
          matchingRules = rules;
          break;
        }
      }
    }

    if (!matchingRules || matchingRules.length === 0) continue;

    // Match claims to rules within the group
    // First try fuzzy text match, then fall back to positional
    const remainingRules = [...matchingRules];

    for (const claim of groupClaims) {
      if (result.has(claim.id)) continue;

      // Fuzzy: find the rule whose slug words best match the claim text
      let bestRule: EvidenceRule | null = null;
      let bestScore = 0;
      let bestIdx = -1;

      for (let i = 0; i < remainingRules.length; i++) {
        const rule = remainingRules[i];
        const lastPart = rule.claimId.split(".").pop()!;
        const ruleWords = lastPart.split(/[-_]/).filter((w) => w.length > 2);
        if (ruleWords.length === 0) continue;

        const claimLower = claim.text.toLowerCase();
        const matchCount = ruleWords.filter((w) => claimLower.includes(w.toLowerCase())).length;
        const score = matchCount / ruleWords.length;

        if (score > bestScore) {
          bestScore = score;
          bestRule = rule;
          bestIdx = i;
        }
      }

      // Accept if at least 30% of slug words match (lower threshold for longer slugs)
      if (bestRule && bestScore >= 0.3) {
        result.set(claim.id, bestRule);
        remainingRules.splice(bestIdx, 1);
      }
    }

    // Positional fallback: match remaining claims to remaining rules by order
    const unmatchedClaims = groupClaims.filter((c) => !result.has(c.id));
    for (let i = 0; i < Math.min(unmatchedClaims.length, remainingRules.length); i++) {
      result.set(unmatchedClaims[i].id, remainingRules[i]);
    }
  }

  return result;
}

function makeUntestedScore(claim: Claim): InvariantScore {
  return {
    claim,
    composite: 0,
    dimensions: {
      coverage: 0,
      seedDiversity: 0,
      assertionStrength: 0,
      diagnosticDepth: 0,
      freshness: null,
      oracleQuality: null,
    },
    evidence: {
      testFiles: [],
      assertionCount: 0,
      testCaseCount: 0,
      lastSpecCommit: null,
      lastTestCommit: null,
    },
    snippets: [],
  };
}

function findFiles(root: string, patterns: string[]): string[] {
  const files: string[] = [];
  for (const pattern of patterns) {
    try {
      const matches = globSync(join(root, pattern), { nodir: true });
      for (const m of matches) {
        if (!m.includes("node_modules")) {
          files.push(m);
        }
      }
    } catch {
      // glob may fail on some patterns
    }
  }
  // Deduplicate
  return [...new Set(files)];
}

function slugify(text: string): string {
  const stripped = text.replace(/^\d+(\.\d+)*\s*/, "");
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
