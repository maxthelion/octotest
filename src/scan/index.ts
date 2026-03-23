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

  // Score each claim
  const scores: InvariantScore[] = [];

  for (const claim of claims) {
    // Try to find a matching evidence rule
    // Evidence keys use slugs like "behaviour-tree.tree-evaluator"
    // Claims have IDs like "what-a-user-can-do.set-up-and-go.0"
    // We need to match claims to evidence rules
    const rule = findRuleForClaim(claim, ruleMap, evidenceRules);

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
 * Try to match a claim to an evidence rule.
 *
 * Evidence rules use keys like "behaviour-tree.tree-evaluator".
 * Claims have generated IDs. We try exact match first, then
 * fuzzy matching on the claim text against the rule ID.
 */
function findRuleForClaim(
  claim: Claim,
  ruleMap: Map<string, EvidenceRule>,
  allRules: EvidenceRule[]
): EvidenceRule | null {
  // Exact ID match
  if (ruleMap.has(claim.id)) return ruleMap.get(claim.id)!;

  // Try matching by subcategory slug in the evidence key
  // Evidence keys are like "category-slug.claim-slug"
  // Our claim IDs are like "category-slug.subcategory-slug.index"
  for (const rule of allRules) {
    const parts = rule.claimId.split(".");
    if (parts.length >= 2) {
      const ruleCategory = parts[0];
      // Check if the rule's category matches the claim's category or subcategory
      const claimCatSlug = slugify(claim.category);
      const claimSubSlug = claim.subcategory ? slugify(claim.subcategory) : null;

      if (ruleCategory === claimCatSlug || ruleCategory === claimSubSlug) {
        // Fuzzy: check if any pattern words from the rule ID appear in the claim text
        const ruleSlug = parts.slice(1).join("-");
        const ruleWords = ruleSlug.split("-").filter((w) => w.length > 2);
        const claimLower = claim.text.toLowerCase();
        const matchCount = ruleWords.filter((w) => claimLower.includes(w)).length;
        if (matchCount >= Math.ceil(ruleWords.length * 0.5)) {
          return rule;
        }
      }
    }
  }

  return null;
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
