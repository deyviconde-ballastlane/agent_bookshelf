#!/usr/bin/env node
// The other half of the reviewer eval: a branch with three harmless changes and no bug.
// A good review prints []. Anything else is a false alarm.
// The branch comes from fixture/bookshelf.bundle (no plugin, no spec, no answer key in it).
//
// Usage: node ticket-to-merge/evals/run-clean.mjs [--runs 3] [--label clean] [--models review-spec=sonnet,...]
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const runs = Number(arg('runs', 3));
const label = arg('label', 'clean');
const models = arg('models', '');
const WATCHDOG_MS = 210_000;

const plugin = path.resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(path.join(tmpdir(), 'ticket-to-merge-clean-'));

const pluginCopy = path.join(scratch, 'ticket-to-merge');
cpSync(plugin, pluginCopy, { recursive: true, filter: (src) => src !== path.join(plugin, 'evals') });
const overrides = models.split(',').filter(Boolean).map((pair) => pair.split('='));
for (const file of readdirSync(path.join(pluginCopy, 'agents'))) {
  const name = file.replace(/\.md$/, '');
  const hit = overrides.find(([pattern]) => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern));
  if (!hit) continue;
  const agentPath = path.join(pluginCopy, 'agents', file);
  writeFileSync(agentPath, readFileSync(agentPath, 'utf8').replace(/^model: .*$/m, `model: ${hit[1]}`));
}

const work = path.join(scratch, 'repo');
execFileSync('git', ['clone', '-q', '-b', 'main', path.join(import.meta.dirname, 'fixture/bookshelf.bundle'), work]);
execFileSync('git', ['checkout', '-q', '-B', 'review/search-cleanup', 'origin/feature/search-cleanup'], { cwd: work });

const outDir = path.join(import.meta.dirname, 'results', label);
mkdirSync(outDir, { recursive: true });

function review(n) {
  return new Promise((resolve) => {
    const out = path.join(outDir, `run-${n}.json`);
    const started = Date.now();
    const child = spawn('claude', [
      '-p', '/ticket-to-merge:review-pr main',
      '--plugin-dir', pluginCopy,
      '--model', 'sonnet',
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Bash(node *)',
      '--output-format', 'json',
    ], { cwd: work, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const watchdog = setTimeout(() => child.kill('SIGINT'), WATCHDOG_MS);
    child.on('close', () => {
      clearTimeout(watchdog);
      writeFileSync(out, stdout);
      resolve({ out, seconds: Math.round((Date.now() - started) / 1000) });
    });
  });
}

try {
  const results = await Promise.all(Array.from({ length: runs }, (_, i) => new Promise((r) => setTimeout(r, i * 2000)).then(() => review(i + 1))));
  const lines = [`# Clean-branch eval: ${label}`, '', `Three harmless changes, no bug. Model overrides: ${models || 'none'}.`, '', '| Run | Findings | Cost | Wall time |', '|---|---|---|---|'];
  const alarms = [];
  let clean = 0;
  for (const { out, seconds } of results) {
    let findings = null;
    let cost = '';
    try {
      const r = JSON.parse(readFileSync(out, 'utf8'));
      cost = `$${r.total_cost_usd.toFixed(2)}`;
      const block = r.result.match(/```json\s*([\s\S]*?)```/);
      findings = JSON.parse(block ? block[1] : r.result.slice(r.result.indexOf('['), r.result.lastIndexOf(']') + 1));
    } catch { /* reported below */ }
    if (Array.isArray(findings) && findings.length === 0) clean++;
    lines.push(`| ${path.basename(out)} | ${findings ? findings.length : 'no JSON array'} | ${cost} | ${seconds}s |`);
    for (const f of findings ?? []) alarms.push(`- [${path.basename(out)}] ${f.file}:${f.line} (${f.severity}) ${f.issue}`);
  }
  lines.push('', `Clean runs: ${clean} of ${results.length}.`, '', ...(alarms.length ? ['False alarms:', '', ...alarms] : ['No false alarms.']), '');
  writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n'));
  console.log(lines.join('\n'));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
