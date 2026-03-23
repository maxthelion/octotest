import { resolve, join } from "path";
import { existsSync } from "fs";
import { scan } from "../scan/index";
import { aggregateCategories, computeProjectScore } from "../score/aggregate";
import { writeReport } from "../report/json";

export function run(args: string[]): void {
  const command = args[0];

  if (command === "scan") {
    runScan(args.slice(1));
  } else if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
  } else if (command === "version" || command === "--version") {
    console.log("octotest 0.1.0");
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

function runScan(args: string[]): void {
  // Parse options
  let projectRoot = process.cwd();
  let outputPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--project" || args[i] === "-p") && args[i + 1]) {
      projectRoot = resolve(args[++i]);
    } else if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      outputPath = resolve(args[++i]);
    }
  }

  // Validate inputs exist
  const invariantsPath = join(projectRoot, ".shoe-makers", "invariants.md");
  const evidencePath = join(projectRoot, ".shoe-makers", "claim-evidence.yaml");

  if (!existsSync(invariantsPath)) {
    console.error(`Not found: ${invariantsPath}`);
    console.error("Octotest requires .shoe-makers/invariants.md");
    process.exit(1);
  }

  if (!existsSync(evidencePath)) {
    console.error(`Not found: ${evidencePath}`);
    console.error("Octotest requires .shoe-makers/claim-evidence.yaml");
    process.exit(1);
  }

  if (!outputPath) {
    outputPath = join(projectRoot, "octotest-report.json");
  }

  console.log(`Scanning ${projectRoot}...`);

  // Run scan
  const scores = scan(projectRoot);

  // Aggregate
  const categories = aggregateCategories(scores);
  const projectScore = computeProjectScore(categories);

  // Write report
  const report = writeReport(categories, projectScore, outputPath);

  // Print summary
  console.log("");
  console.log(`Project score: ${colorScore(projectScore)}`);
  console.log(`Invariants: ${report.meta.invariantCount} total, ${report.meta.coveredCount} covered, ${report.meta.untestedCount} untested`);
  console.log("");

  for (const cat of categories) {
    console.log(`  ${colorScore(cat.score)} ${cat.name} (${cat.invariants.length} invariants)`);
  }

  console.log("");
  console.log(`Report written to ${outputPath}`);
}

function colorScore(score: number): string {
  const padded = String(score).padStart(3);
  if (score >= 80) return `\x1b[32m${padded}\x1b[0m`; // green
  if (score >= 50) return `\x1b[33m${padded}\x1b[0m`; // amber
  return `\x1b[31m${padded}\x1b[0m`; // red
}

function printHelp(): void {
  console.log(`
octotest — test health diagnostics for spec-driven projects

Usage:
  octotest scan [options]     Run static analysis and produce report

Options:
  --project, -p <path>   Project root (default: cwd)
  --output, -o <path>    Output path (default: ./octotest-report.json)

  help, --help           Show this help
  version, --version     Show version
`);
}
