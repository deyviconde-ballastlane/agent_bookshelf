#!/usr/bin/env node
// Runs /review-pr several times against the planted-bug branch and scores it.
//
// The review runs in a throwaway repository built from two commits: the base on `main` and the planted
// branch on top. The plugin folder, the Claude settings and this answer key are left out of it, so the
// reviewers see what a grader's branch would give them and nothing else. Your checkout is never touched.
//
// Usage: node ticket-to-merge/evals/run.mjs [--runs 3] [--label baseline]
//          [--models review-spec=haiku,review-scope=haiku]   rewrite `model:` in a copy of the agents (a cost lever)
//          [--manifest planted-bugs-hard.json]   score against another answer key (and its branch)
//          [--from-upstream]   the base is upstream `main`, so the diff is the whole feature plus the plants,
//                              the way a grader's branch looks
//          [--no-spec]      drop SPEC.md and CLAUDE.md, so the review falls back to the bare ticket criteria
//          [--with-tests]   install-free test evidence: link node_modules so the script can run the suite
// Output: evals/results/<label>/run-N.json (raw `claude -p` output) and summary.md
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const flag = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const runs = Number(arg('runs', 3));
const label = arg('label', 'baseline');
const models = arg('models', '');
const withSpec = !flag('no-spec');
const fromUpstream = flag('from-upstream');
const withTests = flag('with-tests');
// With tests, the suites share database files under /tmp, so the runs must not start together
const STAGGER_MS = withTests ? 30_000 : 2_000;
const WATCHDOG_MS = 210_000;

const plugin = path.resolve(import.meta.dirname, '..');
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: plugin, encoding: 'utf8' }).trim();
const manifestPath = path.resolve(import.meta.dirname, arg('manifest', 'planted-bugs.json'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

const scratch = mkdtempSync(path.join(tmpdir(), 'ticket-to-merge-eval-'));

// 1. A copy of the plugin without evals/, with the model overrides applied
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

// 2. A two-commit repository: the base, then the planted branch
const work = path.join(scratch, 'repo');
mkdirSync(work);
git(work, 'init', '-q', '-b', 'main');
git(work, 'config', 'user.name', 'eval');
git(work, 'config', 'user.email', 'eval@example.com');
const forkPoint = fromUpstream ? git(repo, 'rev-parse', 'main') : git(repo, 'merge-base', manifest.base, manifest.branch);
const leaveOut = ['ticket-to-merge', '.claude', 'bookshelf.db-shm', 'bookshelf.db-wal', ...(withSpec ? [] : ['SPEC.md', 'CLAUDE.md'])];
function commitTree(ref, message) {
  for (const entry of readdirSync(work)) if (entry !== '.git') rmSync(path.join(work, entry), { recursive: true, force: true });
  execSync(`git -C "${repo}" archive ${ref} | tar -x -C "${work}"`);
  for (const entry of leaveOut) rmSync(path.join(work, entry), { recursive: true, force: true });
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', message);
}
commitTree(forkPoint, fromUpstream ? 'upstream main' : 'BOOK-101: search books by title or author');
git(work, 'checkout', '-q', '-b', 'review/search-tidy');
commitTree(manifest.branch, 'search: tidy up query handling, routes and tests');
if (withTests && existsSync(path.join(repo, 'node_modules'))) symlinkSync(path.join(repo, 'node_modules'), path.join(work, 'node_modules'));

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
    let wrote = false;
    const finish = () => {
      if (wrote) return;
      wrote = true;
      writeFileSync(out, stdout);
      resolve({ out, seconds: Math.round((Date.now() - started) / 1000) });
    };
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    // Now and then a headless session finishes its work and then never exits, so its result is never
    // printed. An interrupt makes it print the result and leave. A review takes about a minute.
    const watchdog = setTimeout(() => child.kill('SIGINT'), WATCHDOG_MS);
    child.on('close', () => { clearTimeout(watchdog); finish(); });
  });
}

try {
  const pending = [];
  for (let n = 1; n <= runs; n++) {
    pending.push(review(n));
    if (n < runs) await new Promise((r) => setTimeout(r, STAGGER_MS));
  }
  const results = await Promise.all(pending);

  const score = execFileSync('node', [path.join(import.meta.dirname, 'score.mjs'), manifestPath, ...results.map((r) => r.out)], { encoding: 'utf8' });
  let totalCost = 0;
  const usage = results.map(({ out, seconds }) => {
    try {
      const r = JSON.parse(readFileSync(out, 'utf8'));
      const m = Object.values(r.modelUsage ?? {});
      const sum = (key) => m.reduce((total, x) => total + (x[key] ?? 0), 0);
      const read = sum('cacheReadInputTokens');
      const all = read + sum('cacheCreationInputTokens') + sum('inputTokens');
      totalCost += r.total_cost_usd;
      const byModel = Object.entries(r.modelUsage ?? {}).map(([name, x]) => `${name.replace(/^claude-/, '')} $${x.costUSD.toFixed(2)}`).join(', ');
      return `| ${path.basename(out)} | $${r.total_cost_usd.toFixed(2)} | ${Math.round((100 * read) / all)}% | ${seconds}s | ${byModel} |`;
    } catch {
      return `| ${path.basename(out)} | no usage data | | ${seconds}s | |`;
    }
  });
  const summary = [
    `# Planted-bug eval: ${label}`,
    '',
    `Branch \`${manifest.branch}\` against its fork point. Spec in the repository: ${withSpec ? 'yes' : 'no, bare ticket criteria'}. Base: ${fromUpstream ? 'upstream main, so the diff is the whole feature plus the plants' : 'the fork point, so the diff is only the plants'}. Model overrides: ${models || 'none'}. Test output given to the reviewers: ${withTests ? 'yes' : 'no'}.`,
    '',
    score.trim(),
    '',
    '| Run | Cost | Cache hit | Wall time | Models |',
    '|---|---|---|---|---|',
    ...usage,
    `| **Mean** | **$${(totalCost / results.length).toFixed(2)}** | | **${Math.round(results.reduce((t, r) => t + r.seconds, 0) / results.length)}s** | |`,
    '',
  ].join('\n');
  writeFileSync(path.join(outDir, 'summary.md'), summary);
  console.log(summary);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
