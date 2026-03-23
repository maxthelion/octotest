import { readFileSync } from "fs";

/**
 * Check if a file's content matches an AND-group of patterns.
 * All patterns in the group must appear in the content (case-insensitive substring).
 */
export function matchesPatternGroup(content: string, patterns: string[]): boolean {
  const lower = content.toLowerCase();
  return patterns.every((p) => lower.includes(p.toLowerCase()));
}

/**
 * Check if a file matches any OR-group of patterns.
 * Returns true if at least one AND-group is fully satisfied.
 */
export function matchesAnyPatternGroup(content: string, patternGroups: string[][]): boolean {
  return patternGroups.some((group) => matchesPatternGroup(content, group));
}

/**
 * Find all files whose content matches the given pattern groups.
 * Returns the file paths that match.
 */
export function findMatchingFiles(
  files: string[],
  patternGroups: string[][],
  contentCache: Map<string, string>
): string[] {
  if (patternGroups.length === 0) return [];

  return files.filter((file) => {
    const content = getContent(file, contentCache);
    return matchesAnyPatternGroup(content, patternGroups);
  });
}

/**
 * Strip comments from source code before matching.
 * Removes // line comments and /* block comments.
 */
export function stripComments(content: string): string {
  // Remove block comments
  let result = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments
  result = result.replace(/\/\/.*$/gm, "");
  return result;
}

export function getContent(file: string, cache: Map<string, string>): string {
  let content = cache.get(file);
  if (content === undefined) {
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      content = "";
    }
    cache.set(file, content);
  }
  return content;
}
