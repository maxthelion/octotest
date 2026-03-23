export interface Claim {
  id: string;
  text: string;
  category: string;
  subcategory: string | null;
}

export interface EvidenceRule {
  claimId: string;
  sourcePatterns: string[][];  // outer = OR groups, inner = AND patterns
  testPatterns: string[][];    // outer = OR groups, inner = AND patterns
}

export interface DimensionScores {
  coverage: number;
  seedDiversity: number;
  assertionStrength: number;
  diagnosticDepth: number;
  freshness: number;
  oracleQuality: number | null;
}

export interface Evidence {
  testFiles: string[];
  assertionCount: number;
  testCaseCount: number;
  lastSpecCommit: string | null;
  lastTestCommit: string | null;
}

export interface InvariantScore {
  claim: Claim;
  composite: number;
  dimensions: DimensionScores;
  evidence: Evidence;
  snippets: string[];
}

export interface CategoryScore {
  name: string;
  score: number;
  invariants: InvariantScore[];
}

export interface OctotestReport {
  version: 1;
  timestamp: string;
  projectScore: number;
  categories: CategoryScore[];
  meta: {
    llmEnriched: boolean;
    invariantCount: number;
    coveredCount: number;
    untestedCount: number;
  };
}

export interface ScanContext {
  projectRoot: string;
  invariantsPath: string;
  evidencePath: string;
  testFiles: string[];
  sourceFiles: string[];
}
