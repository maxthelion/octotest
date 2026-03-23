import { readFileSync } from "fs";
import type { Claim } from "../types";

/**
 * Parse .shoe-makers/invariants.md into structured claims.
 *
 * Format:
 *   ## Category Name
 *   ### Subcategory Name
 *   - Claim text here
 *   - Another claim
 */
export function parseInvariants(filePath: string): Claim[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const claims: Claim[] = [];

  let currentCategory = "";
  let currentSubcategory: string | null = null;
  let claimIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // ## heading = category
    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      currentCategory = trimmed.slice(3).trim();
      currentSubcategory = null;
      claimIndex = 0;
      continue;
    }

    // ### heading = subcategory
    if (trimmed.startsWith("### ")) {
      currentSubcategory = trimmed.slice(4).trim();
      claimIndex = 0;
      continue;
    }

    // - bullet = claim
    if (trimmed.startsWith("- ") && currentCategory) {
      const text = trimmed.slice(2).trim();
      if (!text) continue;

      // Build an ID like "behaviour-tree.tree-evaluator" from the evidence keys
      // For now use category slug + index
      const categorySlug = slugify(currentCategory);
      const subSlug = currentSubcategory ? slugify(currentSubcategory) : null;
      const prefix = subSlug ? `${categorySlug}.${subSlug}` : categorySlug;

      claims.push({
        id: `${prefix}.${claimIndex}`,
        text,
        category: currentCategory,
        subcategory: currentSubcategory,
      });
      claimIndex++;
    }
  }

  return claims;
}

function slugify(text: string): string {
  // Strip leading numbers like "1." or "1.2"
  const stripped = text.replace(/^\d+(\.\d+)*\s*/, "");
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
