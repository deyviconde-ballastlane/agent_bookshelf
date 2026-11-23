#!/usr/bin/env node
// Deterministic last step of /review-pr. Two checks that a prompt can only ask for:
//
//   1. Line numbers. A reviewer sometimes reports a line of the diff file instead of the source file.
//      A line is trusted when it sits next to something the branch changed. Otherwise the script looks
//      for the code quoted in the finding (the text between backticks) and moves the finding there.
//   2. Scope. A finding in a file the branch changed must sit within SCOPE lines of a change. Further
//      away, it is about code this branch did not write, and it is dropped. Reviewers that find nothing
//      wrong in a diff tend to go looking in the code around it.
//
// Findings in files the branch did not change at all are left for the verifier's judgement: a missing
// test is often reported there. The script never invents a finding. What it moves or drops goes to stderr.
// Usage: node anchor-lines.mjs [findings.json]     prints the final array
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const NEAR = 3;
const SCOPE = 8;
const file = process.argv[2] || '.ticket-to-merge/findings.json';
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };

let findings = readJson(file, null);
if (!Array.isArray(findings)) {
  // Tolerate a file that holds the array inside a code block or after a sentence
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  try { findings = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); } catch { findings = null; }
}
if (!Array.isArray(findings)) {
  console.error(`anchor-lines: ${file} does not hold a JSON array of findings.`);
  process.exit(1);
}

const changed = readJson(path.join(path.dirname(file), 'changed-lines.json'), {});
const moved = [];
const dropped = [];
const result = [];

for (const finding of findings) {
  const source = String(finding.file ?? '').replace(/^\.\//, '');
  const out = { file: source, line: Number(finding.line) || 1, severity: finding.severity, issue: finding.issue, evidence: finding.evidence };
  const changedHere = changed[source] ?? [];
  // A deleted file, or a file the branch did not change: nothing to check the line against
  if (!existsSync(source) || changedHere.length === 0) { result.push(out); continue; }

  const lines = readFileSync(source, 'utf8').split('\n');
  const within = (n, reach) => changedHere.some((c) => Math.abs(c - n) <= reach);

  if (!(out.line >= 1 && out.line <= lines.length && within(out.line, NEAR))) {
    // Not next to a change: find the quoted code on a changed line, longest quote first
    const quotes = [...`${finding.evidence ?? ''} ${finding.issue ?? ''}`.matchAll(/`([^`\n]{4,})`/g)]
      .map((m) => m[1].trim())
      .sort((a, b) => b.length - a.length);
    for (const quote of quotes) {
      const target = lines.flatMap((text, i) => (text.includes(quote) ? [i + 1] : [])).find((n) => within(n, NEAR));
      if (target) {
        moved.push(`${source}: ${out.line} -> ${target}`);
        out.line = target;
        break;
      }
    }
  }

  if (within(out.line, SCOPE)) result.push(out);
  else dropped.push(`${source}:${out.line} ${String(out.issue).slice(0, 90)}`);
}

if (moved.length) console.error(`anchor-lines: corrected ${moved.length} line number(s): ${moved.join('; ')}`);
if (dropped.length) console.error(`anchor-lines: dropped ${dropped.length} finding(s) about code this branch did not change:\n  ${dropped.join('\n  ')}`);
console.log(JSON.stringify(result, null, 2));
