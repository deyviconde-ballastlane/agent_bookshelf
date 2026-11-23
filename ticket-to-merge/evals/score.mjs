#!/usr/bin/env node
// Scores /review-pr output against the planted-bug manifest.
//   recall    = planted bugs found / planted bugs
//   precision = findings that point at a planted bug / all findings
// A finding counts for a plant when it names the same file and either lands within TOLERANCE lines of
// the planted lines or matches one of the plant's keywords. Anything else is listed for a human to judge.
// Usage: node score.mjs <manifest.json> <findings.json> [<findings.json> ...]
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOLERANCE = 4;
const [manifestPath, ...runPaths] = process.argv.slice(2);
if (!manifestPath || runPaths.length === 0) {
  console.error('Usage: node score.mjs <manifest.json> <findings.json> [<findings.json> ...]');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Accepts a bare array, {result: "…```json […]```…"} from `claude -p --output-format json`, or raw text
export function extractFindings(text) {
  let body = text;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed.result === 'string') body = parsed.result;
  } catch { /* not JSON as a whole */ }
  const fenced = body.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : body.slice(body.indexOf('['), body.lastIndexOf(']') + 1);
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const sameFile = (a, b) => path.posix.normalize(String(a ?? '')).replace(/^\.\//, '') === b;
const near = (line, [from, to]) => Number(line) >= from - TOLERANCE && Number(line) <= to + TOLERANCE;
const text = (f) => `${f.issue ?? ''} ${f.evidence ?? ''}`.toLowerCase();

// Two plants can sit a few lines apart, and one plant can span two files. So the order of preference is:
// near the lines and about the same thing, then same file and about the same thing, then nearest by line.
function match(finding, entries) {
  const inFile = entries.filter((e) => [e.file, ...(e.alsoFiles ?? [])].some((file) => sameFile(finding.file, file)));
  const about = (e) => (e.keywords ?? []).some((k) => new RegExp(k, 'i').test(text(finding)));
  const distance = (e) => Math.min(...e.lines.map((l) => Math.abs(Number(finding.line) - l)));
  const close = inFile.filter((e) => sameFile(finding.file, e.file) && near(finding.line, e.lines)).sort((a, b) => distance(a) - distance(b));
  return close.find(about) ?? inFile.find(about) ?? close[0] ?? null;
}

const rows = [];
for (const runPath of runPaths) {
  const findings = extractFindings(readFileSync(runPath, 'utf8'));
  if (!findings) {
    rows.push({ run: path.basename(runPath), error: 'no JSON array of findings in the output' });
    continue;
  }
  const found = new Set();
  const real = [];
  const flaggedClean = [];
  const unmatched = [];
  for (const finding of findings) {
    const plant = match(finding, manifest.plants);
    if (plant) { found.add(plant.id); real.push(`${plant.id} <- ${finding.file}:${finding.line}`); continue; }
    const clean = match(finding, manifest.clean ?? []);
    (clean ? flaggedClean : unmatched).push(`${clean ? `${clean.id} ` : ''}${finding.file}:${finding.line} ${String(finding.issue).slice(0, 110)}`);
  }
  rows.push({
    run: path.basename(runPath),
    findings: findings.length,
    found: [...found].sort(),
    missed: manifest.plants.map((p) => p.id).filter((id) => !found.has(id)),
    recall: found.size / manifest.plants.length,
    precision: findings.length ? real.length / findings.length : 1,
    flaggedClean,
    unmatched,
  });
}

const pct = (n) => `${Math.round(n * 100)}%`;
const scored = rows.filter((r) => !r.error);
const mean = (key) => scored.reduce((sum, r) => sum + r[key], 0) / (scored.length || 1);

console.log(`Planted bugs: ${manifest.plants.length} · clean decoys: ${(manifest.clean ?? []).length} · runs: ${rows.length}\n`);
console.log('| Run | Findings | Found | Missed | Recall | Precision |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
  if (r.error) { console.log(`| ${r.run} | ${r.error} | | | | |`); continue; }
  console.log(`| ${r.run} | ${r.findings} | ${r.found.join(' ') || '-'} | ${r.missed.join(' ') || '-'} | ${pct(r.recall)} | ${pct(r.precision)} |`);
}
console.log(`| **Mean** | | | | **${pct(mean('recall'))}** | **${pct(mean('precision'))}** |`);
console.log(`\nCapstone points at this level: recall ${(6 * mean('recall')).toFixed(1)} / 6, precision ${(4 * mean('precision')).toFixed(1)} / 4`);

for (const r of scored) {
  for (const line of r.flaggedClean) console.log(`\n[${r.run}] flagged clean code: ${line}`);
  for (const line of r.unmatched) console.log(`\n[${r.run}] not a plant (judge by hand): ${line}`);
}

if (process.argv.includes('--json')) console.log(`\n${JSON.stringify(rows, null, 2)}`);
