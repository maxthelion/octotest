import { writeFileSync } from "fs";
import type { OctotestReport, CategoryScore, InvariantScore } from "../types";

export function writeHtmlReport(report: OctotestReport, outputPath: string): void {
  const html = generateHtml(report);
  writeFileSync(outputPath, html);
}

function generateHtml(report: OctotestReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Octotest Report</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="layout">
  <main>
    <header>
      <div class="header-top">
        <h1>Octotest Report</h1>
        <span class="timestamp">${new Date(report.timestamp).toLocaleString()}</span>
      </div>
      <div class="project-score ${scoreClass(report.projectScore)}">
        <span class="score-value">${report.projectScore}</span>
        <span class="score-label">Project Score</span>
      </div>
      ${report.meta.llmEnriched ? '<span class="badge badge-llm">LLM Enriched</span>' : '<span class="badge badge-static">Static Analysis Only</span>'}
    </header>

    <div class="tree">
      ${report.categories.map(renderCategory).join("\n")}
    </div>
  </main>

  <aside class="sidebar">
    <div class="sidebar-section">
      <h3>Summary</h3>
      <div class="stats">
        <div class="stat">
          <span class="stat-value">${report.meta.invariantCount}</span>
          <span class="stat-label">Invariants</span>
        </div>
        <div class="stat">
          <span class="stat-value">${report.meta.coveredCount}</span>
          <span class="stat-label">Covered</span>
        </div>
        <div class="stat">
          <span class="stat-value ${report.meta.untestedCount > 0 ? "text-red" : ""}">${report.meta.untestedCount}</span>
          <span class="stat-label">Untested</span>
        </div>
      </div>
      <div class="coverage-bar">
        <div class="coverage-fill" style="width: ${report.meta.invariantCount > 0 ? Math.round((report.meta.coveredCount / report.meta.invariantCount) * 100) : 0}%"></div>
      </div>
      <span class="coverage-label">${report.meta.invariantCount > 0 ? Math.round((report.meta.coveredCount / report.meta.invariantCount) * 100) : 0}% coverage</span>
    </div>

    <div class="sidebar-section">
      <h3>Worst Invariants</h3>
      ${renderWorstInvariants(report)}
    </div>

    <div class="sidebar-section">
      <h3>Categories</h3>
      ${report.categories.map(renderCategorySummary).join("\n")}
    </div>
  </aside>
</div>

<script>
${JS}
</script>
</body>
</html>`;
}

function renderCategory(cat: CategoryScore): string {
  const distribution = getDistribution(cat.invariants);
  return `
    <div class="category">
      <div class="category-header" onclick="toggleCategory(this)">
        <span class="expand-icon">&#9654;</span>
        <span class="score-badge ${scoreClass(cat.score)}">${cat.score}</span>
        <span class="category-name">${escapeHtml(cat.name)}</span>
        <span class="category-count">${cat.invariants.length} invariants</span>
        <div class="distribution-bar">
          <div class="dist-green" style="width: ${distribution.green}%"></div>
          <div class="dist-amber" style="width: ${distribution.amber}%"></div>
          <div class="dist-red" style="width: ${distribution.red}%"></div>
        </div>
      </div>
      <div class="category-body" style="display: none;">
        ${cat.invariants.map(renderInvariant).join("\n")}
      </div>
    </div>`;
}

function renderInvariant(inv: InvariantScore): string {
  const dims = inv.dimensions;
  return `
    <div class="invariant">
      <div class="invariant-header" onclick="toggleInvariant(this)">
        <span class="expand-icon">&#9654;</span>
        <span class="score-badge ${scoreClass(inv.composite)}">${inv.composite}</span>
        <span class="invariant-text">${escapeHtml(inv.claim.text)}</span>
      </div>
      <div class="invariant-body" style="display: none;">
        <div class="dimensions">
          ${renderDimBar("Coverage", dims.coverage, 25)}
          ${renderDimBar("Seed Diversity", dims.seedDiversity, 15)}
          ${renderDimBar("Assertion Strength", dims.assertionStrength, 20)}
          ${renderDimBar("Diagnostic Depth", dims.diagnosticDepth, 15)}
          ${dims.oracleQuality !== null ? renderDimBar("Oracle Quality", dims.oracleQuality, 15) : renderDimBar("Oracle Quality", null, 15)}
          ${dims.freshness !== null ? renderDimBar("Freshness", dims.freshness, 10) : renderDimBar("Freshness", null, 10)}
        </div>
        <div class="evidence">
          <h4>Evidence</h4>
          ${inv.evidence.testFiles.length > 0
            ? `<ul class="evidence-list">
                ${inv.evidence.testFiles.map((f) => `<li class="evidence-file">${escapeHtml(shortenPath(f))}</li>`).join("")}
              </ul>
              <div class="evidence-stats">
                <span>${inv.evidence.testCaseCount} test case${inv.evidence.testCaseCount !== 1 ? "s" : ""}</span>
                <span>${inv.evidence.assertionCount} assertion${inv.evidence.assertionCount !== 1 ? "s" : ""}</span>
              </div>`
            : '<p class="no-evidence">No test evidence found</p>'}
          ${inv.evidence.lastSpecCommit ? `<div class="dates"><span>Spec: ${inv.evidence.lastSpecCommit.slice(0, 10)}</span>${inv.evidence.lastTestCommit ? `<span>Test: ${inv.evidence.lastTestCommit.slice(0, 10)}</span>` : ""}</div>` : ""}
        </div>
      </div>
    </div>`;
}

function renderDimBar(label: string, value: number | null, weight: number): string {
  if (value === null) {
    return `
      <div class="dim-row">
        <span class="dim-label">${label} <span class="dim-weight">(${weight}%)</span></span>
        <div class="dim-bar-track">
          <div class="dim-bar-fill dim-unknown" style="width: 100%"></div>
        </div>
        <span class="dim-value dim-na">N/A</span>
      </div>`;
  }
  return `
    <div class="dim-row">
      <span class="dim-label">${label} <span class="dim-weight">(${weight}%)</span></span>
      <div class="dim-bar-track">
        <div class="dim-bar-fill ${scoreClass(value)}" style="width: ${value}%"></div>
      </div>
      <span class="dim-value">${value}</span>
    </div>`;
}

function renderWorstInvariants(report: OctotestReport): string {
  const all = report.categories.flatMap((c) => c.invariants);
  // Sort by composite ascending, take worst 5 that have at least some coverage
  const covered = all.filter((i) => i.dimensions.coverage > 0);
  const uncovered = all.filter((i) => i.dimensions.coverage === 0);

  let items = "";

  if (covered.length > 0) {
    const worst = [...covered].sort((a, b) => a.composite - b.composite).slice(0, 5);
    items += '<h4 class="worst-heading">Weakest Covered</h4>';
    items += worst
      .map(
        (inv) =>
          `<div class="worst-item">
            <span class="score-badge-sm ${scoreClass(inv.composite)}">${inv.composite}</span>
            <span class="worst-text">${escapeHtml(inv.claim.text.slice(0, 60))}${inv.claim.text.length > 60 ? "..." : ""}</span>
          </div>`
      )
      .join("");
  }

  if (uncovered.length > 0) {
    items += `<h4 class="worst-heading">Untested (${uncovered.length})</h4>`;
    const sample = uncovered.slice(0, 5);
    items += sample
      .map(
        (inv) =>
          `<div class="worst-item">
            <span class="score-badge-sm score-red">0</span>
            <span class="worst-text">${escapeHtml(inv.claim.text.slice(0, 60))}${inv.claim.text.length > 60 ? "..." : ""}</span>
          </div>`
      )
      .join("");
    if (uncovered.length > 5) {
      items += `<div class="worst-more">...and ${uncovered.length - 5} more</div>`;
    }
  }

  return items || "<p>No invariants found</p>";
}

function renderCategorySummary(cat: CategoryScore): string {
  return `
    <div class="cat-summary">
      <span class="score-badge-sm ${scoreClass(cat.score)}">${cat.score}</span>
      <span class="cat-summary-name">${escapeHtml(cat.name)}</span>
    </div>`;
}

function getDistribution(invariants: InvariantScore[]): { green: number; amber: number; red: number } {
  if (invariants.length === 0) return { green: 0, amber: 0, red: 0 };
  let g = 0, a = 0, r = 0;
  for (const inv of invariants) {
    if (inv.composite >= 80) g++;
    else if (inv.composite >= 50) a++;
    else r++;
  }
  const total = invariants.length;
  return {
    green: Math.round((g / total) * 100),
    amber: Math.round((a / total) * 100),
    red: Math.round((r / total) * 100),
  };
}

function scoreClass(score: number): string {
  if (score >= 80) return "score-green";
  if (score >= 50) return "score-amber";
  return "score-red";
}

function shortenPath(fullPath: string): string {
  // Show from src/ or test/ onwards, or last 3 segments
  const parts = fullPath.split("/");
  const srcIdx = parts.findIndex((p) => p === "src" || p === "test" || p === "tests" || p === "__tests__");
  if (srcIdx >= 0) return parts.slice(srcIdx).join("/");
  return parts.slice(-3).join("/");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0d1117;
  color: #c9d1d9;
  line-height: 1.5;
}
.layout {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  gap: 24px;
}
main { flex: 1; min-width: 0; }
.sidebar {
  width: 320px;
  flex-shrink: 0;
}
header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #21262d;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
}
h1 { font-size: 24px; font-weight: 600; color: #f0f6fc; }
.timestamp { font-size: 13px; color: #8b949e; }
.project-score {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.project-score .score-value {
  font-size: 48px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.project-score .score-label {
  font-size: 14px;
  opacity: 0.8;
}
.score-green { background: #0d2818; color: #3fb950; }
.score-amber { background: #2d1b00; color: #d29922; }
.score-red { background: #2d0000; color: #f85149; }
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
}
.badge-llm { background: #1f2d5c; color: #79c0ff; }
.badge-static { background: #21262d; color: #8b949e; }

/* Tree */
.category { margin-bottom: 4px; }
.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}
.category-header:hover { background: #1c2128; }
.category-header.expanded { border-radius: 6px 6px 0 0; }
.expand-icon {
  font-size: 10px;
  transition: transform 0.15s;
  color: #8b949e;
  width: 12px;
}
.expanded > .expand-icon { transform: rotate(90deg); }
.category-name { font-weight: 600; color: #f0f6fc; flex: 1; }
.category-count { font-size: 12px; color: #8b949e; }
.category-body {
  border: 1px solid #21262d;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 4px;
}
.distribution-bar {
  display: flex;
  width: 80px;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: #21262d;
}
.dist-green { background: #3fb950; }
.dist-amber { background: #d29922; }
.dist-red { background: #f85149; }

/* Invariants */
.invariant { margin: 2px 0; }
.invariant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.invariant-header:hover { background: #1c2128; }
.invariant-text {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.invariant-body {
  padding: 12px 16px 12px 40px;
}

/* Score badges */
.score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 24px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}
.score-badge-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 20px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 3px;
  font-variant-numeric: tabular-nums;
}

/* Dimensions */
.dimensions { margin-bottom: 12px; }
.dim-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.dim-label {
  width: 160px;
  font-size: 12px;
  flex-shrink: 0;
}
.dim-weight { color: #8b949e; }
.dim-bar-track {
  flex: 1;
  height: 8px;
  background: #21262d;
  border-radius: 4px;
  overflow: hidden;
}
.dim-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}
.dim-bar-fill.score-green { background: #3fb950; }
.dim-bar-fill.score-amber { background: #d29922; }
.dim-bar-fill.score-red { background: #f85149; }
.dim-unknown { background: #30363d; }
.dim-value {
  width: 30px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dim-na { color: #484f58; }

/* Evidence */
.evidence h4 {
  font-size: 12px;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
.evidence-list {
  list-style: none;
  margin-bottom: 6px;
}
.evidence-file {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  color: #79c0ff;
  padding: 2px 0;
}
.evidence-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8b949e;
}
.no-evidence {
  font-size: 13px;
  color: #f85149;
  font-style: italic;
}
.dates {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #8b949e;
  margin-top: 4px;
}

/* Sidebar */
.sidebar-section {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 12px;
}
.sidebar-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #f0f6fc;
  margin-bottom: 12px;
}
.stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}
.stat { text-align: center; flex: 1; }
.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #f0f6fc;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 11px;
  color: #8b949e;
  text-transform: uppercase;
}
.text-red { color: #f85149; }
.coverage-bar {
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}
.coverage-fill {
  height: 100%;
  background: #3fb950;
  border-radius: 3px;
}
.coverage-label {
  font-size: 11px;
  color: #8b949e;
}
.worst-heading {
  font-size: 11px;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 8px 0 6px;
}
.worst-heading:first-child { margin-top: 0; }
.worst-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.worst-text {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.worst-more {
  font-size: 11px;
  color: #8b949e;
  padding: 4px 0;
}
.cat-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.cat-summary-name { font-size: 13px; }

@media (max-width: 900px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; }
}
`;

const JS = `
function toggleCategory(el) {
  const body = el.nextElementSibling;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  el.classList.toggle('expanded', !isOpen);
}
function toggleInvariant(el) {
  const body = el.nextElementSibling;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  el.classList.toggle('expanded', !isOpen);
}
`;
