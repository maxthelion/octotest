import { readFileSync } from "fs";
import type { EvidenceRule } from "../types";

/**
 * Parse .shoe-makers/claim-evidence.yaml into structured evidence rules.
 *
 * Format:
 *   category.claim-slug:
 *     source:
 *       - [pattern1, pattern2]    # AND group
 *       - [pattern3]              # OR alternative
 *     test:
 *       - [pattern1]
 *
 * Uses a simple line-by-line parser — no YAML dependency needed.
 */
export function parseEvidence(filePath: string): EvidenceRule[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const rules: EvidenceRule[] = [];

  let currentId: string | null = null;
  let currentSection: "source" | "test" | null = null;
  let currentRule: { sourcePatterns: string[][]; testPatterns: string[][] } | null = null;

  for (const line of lines) {
    // Skip comments and blank lines
    if (line.trim().startsWith("#") || line.trim() === "") {
      continue;
    }

    // Top-level key: "category.claim-slug:"
    if (!line.startsWith(" ") && !line.startsWith("\t") && line.endsWith(":")) {
      // Save previous rule
      if (currentId && currentRule) {
        rules.push({ claimId: currentId, ...currentRule });
      }
      currentId = line.slice(0, -1).trim();
      currentRule = { sourcePatterns: [], testPatterns: [] };
      currentSection = null;
      continue;
    }

    const trimmed = line.trim();

    // Section header: "source:" or "test:"
    if (trimmed === "source:") {
      currentSection = "source";
      continue;
    }
    if (trimmed === "test:") {
      currentSection = "test";
      continue;
    }

    // Pattern array: "- [pattern1, pattern2]"
    if (trimmed.startsWith("- [") && currentRule && currentSection) {
      const patterns = parsePatternArray(trimmed);
      if (currentSection === "source") {
        currentRule.sourcePatterns.push(patterns);
      } else {
        currentRule.testPatterns.push(patterns);
      }
    }
  }

  // Save last rule
  if (currentId && currentRule) {
    rules.push({ claimId: currentId, ...currentRule });
  }

  return rules;
}

/**
 * Parse a YAML-style array line like:
 *   - [pattern1, "pattern with spaces"]
 * into ["pattern1", "pattern with spaces"]
 */
function parsePatternArray(line: string): string[] {
  // Extract content between [ and ]
  const match = line.match(/\[(.+)\]/);
  if (!match) return [];

  const inner = match[1];
  const patterns: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
    } else if (inQuote && ch === quoteChar) {
      inQuote = false;
    } else if (!inQuote && ch === ",") {
      const trimmed = current.trim();
      if (trimmed) patterns.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed) patterns.push(trimmed);

  return patterns;
}
