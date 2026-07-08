#!/usr/bin/env node
/**
 * Fast, deterministic docs-drift check. Runs from the pre-push git hook
 * (.githooks/pre-push) — must stay dependency-free and fast (<1s).
 *
 * Checks:
 *   1. Relative markdown links in docs resolve to files that exist.
 *   2. Numeric claims that rot (invariant test count in Weeber-Cursor-Rules.md).
 *
 * On drift: prints findings and exits 1. Fix the docs (or run a full sync
 * with Claude Code), or bypass once with `git push --no-verify`.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "archive"]);

function collectMarkdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectMarkdownFiles(join(dir, entry.name), out);
    } else if (entry.name.endsWith(".md")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const problems = [];

// --- Check 1: relative markdown links resolve ---
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;
for (const file of collectMarkdownFiles(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(LINK_RE)) {
    let target = match[1];
    if (/^(https?:|mailto:|file:|#|<)/.test(target)) continue;
    target = decodeURIComponent(target.split("#")[0]);
    if (!target) continue;
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) {
      problems.push(`${file.slice(ROOT.length + 1)}: broken link -> ${match[1]}`);
    }
  }
}

// --- Check 2: invariant test count claim matches reality ---
const rulesPath = join(ROOT, "docs", "Weeber-Cursor-Rules.md");
const invariantsDir = join(ROOT, "backend", "src", "tests", "invariants");
if (existsSync(rulesPath) && existsSync(invariantsDir) && statSync(invariantsDir).isDirectory()) {
  const claimed = readFileSync(rulesPath, "utf8").match(/(\d+) test files/);
  const actual = readdirSync(invariantsDir).filter((f) => f.endsWith(".test.js")).length;
  if (claimed && Number(claimed[1]) !== actual) {
    problems.push(
      `docs/Weeber-Cursor-Rules.md: claims ${claimed[1]} invariant test files, found ${actual} in backend/src/tests/invariants/`
    );
  }
}

if (problems.length) {
  console.error("Docs drift detected:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nFix the docs above, or run a full docs sync with Claude Code:" +
      '\n  claude -p "Compare CLAUDE.md, README.md and docs/ against the source code and fix drift"' +
      "\nBypass once with: git push --no-verify\n"
  );
  process.exit(1);
}

console.log("docs drift check: OK");
