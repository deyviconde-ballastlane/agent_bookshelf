#!/usr/bin/env node
// Deterministic last step of /review-pr: every finding must point at a real line of the file.
// A reviewer sometimes reports a line number of the diff file instead of the source file. Asking it
// not to is a request; this check is the guarantee.
//
// A line is trusted when it sits on or next to a line the diff changed. Otherwise the script looks for
// the code quoted in the finding (the text between backticks) and moves the finding to the changed line
// that contains it. It never invents a finding and never removes one.
// Usage: node anchor-lines.mjs [findings.json]     prints the final array
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const NEAR = 3;
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

const result = findings.map((finding) => {
  const source = String(finding.file ?? '').replace(/^\.\//, '');
  const out = { file: source, line: Number(finding.line) || 1, severity: finding.severity, issue: finding.issue, evidence: finding.evidence };
  if (!existsSync(source)) return out; // a deleted file keeps the line the reviewer gave

  const lines = readFileSync(source, 'utf8').split('\n');
  const changedHere = changed[source] ?? [];
  const nearChange = (n) => changedHere.some((c) => Math.abs(c - n) <= NEAR);
  const inFile = out.line >= 1 && out.line <= lines.length;
  if (inFile && (changedHere.length === 0 || nearChange(out.line))) return out;

  // Not next to anything the diff changed: find the quoted code, longest quote first
  const quotes = [...`${finding.evidence ?? ''} ${finding.issue ?? ''}`.matchAll(/`([^`\n]{4,})`/g)]
    .map((m) => m[1].trim())
    .sort((a, b) => b.length - a.length);
  for (const quote of quotes) {
    const hits = lines.flatMap((text, i) => (text.includes(quote) ? [i + 1] : []));
    const target = hits.find(nearChange) ?? (changedHere.length === 0 ? hits[0] : undefined);
    if (target) {
      moved.push(`${source}: ${out.line} -> ${target}`);
      out.line = target;
      return out;
    }
  }
  if (!inFile) {
    const fallback = changedHere[0] ?? 1;
    moved.push(`${source}: ${out.line} -> ${fallback} (line was outside the file)`);
    out.line = fallback;
  }
  return out;
});

if (moved.length) console.error(`anchor-lines: corrected ${moved.length} line number(s): ${moved.join('; ')}`);
console.log(JSON.stringify(result, null, 2));
