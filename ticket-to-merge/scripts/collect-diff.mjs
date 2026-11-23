#!/usr/bin/env node
// Deterministic first step of /review-pr. One command, no model tokens:
//   1. finds the base and writes the diff to .ticket-to-merge/review.diff (git-ignored locally),
//      with the real line number of the source file on every line
//   2. lists the changed files and locates the spec
//   3. checks the hard constraints that need no judgement (protected files, dependencies, skipped tests)
//   4. runs the test suite once, if dependencies are installed
// Prints one JSON object. Usage: node collect-diff.mjs [base-ref] [--no-tests]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const runTests = !args.includes('--no-tests');
const baseArg = args.find((a) => !a.startsWith('--'));

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
const fail = (error) => { console.log(JSON.stringify({ error })); process.exit(0); };

const root = tryGit('rev-parse', '--show-toplevel');
if (!root) fail('Not inside a git repository.');
process.chdir(root);

const base = [baseArg, 'main', 'origin/main', 'master', 'origin/master'].find((ref) => ref && tryGit('rev-parse', '--verify', '--quiet', `${ref}^{commit}`));
if (!base) fail(`No base ref found (tried ${baseArg ?? 'main'}, origin/main, master). Pass one: /review-pr <base>.`);
const mergeBase = tryGit('merge-base', 'HEAD', base) ?? git('rev-parse', base);

// Never review the plugin itself, Claude settings, the lockfile body or the workspace
const pluginRel = path.relative(root, path.resolve(import.meta.dirname, '..'));
const skip = ['.ticket-to-merge', '.claude', 'package-lock.json'];
if (pluginRel && !pluginRel.startsWith('..')) skip.push(pluginRel);
const pathspec = ['--', '.', ...skip.map((p) => `:(exclude)${p}`)];

// Working tree against the merge base: committed and uncommitted changes together
let diff = git('diff', '--no-color', '--no-ext-diff', '-U10', mergeBase, ...pathspec);
const changed = git('diff', '--no-color', '--name-status', mergeBase, ...pathspec)
  .split('\n').filter(Boolean)
  .map((line) => { const [status, ...rest] = line.split('\t'); return { status: status[0], file: rest.at(-1) }; });

const untracked = (tryGit('ls-files', '--others', '--exclude-standard', ...pathspec) ?? '').split('\n').filter(Boolean);
for (const file of untracked) {
  const info = lstatSync(file);
  if (!info.isFile() || info.size > 200_000) continue; // skip symlinks, folders and large files
  const body = spawnSync('git', ['diff', '--no-color', '--no-index', '-U10', '/dev/null', file], { encoding: 'utf8' }).stdout;
  diff += `\n${body}`;
  changed.push({ status: 'A', file });
}

// Reviewers read the diff with a tool that numbers the lines of the diff file itself, and those numbers
// are easy to mistake for source lines. So every line of the diff carries its real line number in the
// file as it is now (L41), and removed lines carry none.
const changedLines = {};
function annotate(unified) {
  const out = [
    '# Each line starts with its line number in the file as it is now, for example L41.',
    '# Use that number in findings. Lines marked "-" were removed and have no number.',
    '',
  ];
  let file = null;
  let line = 0;
  for (const row of unified.split('\n')) {
    if (row.startsWith('diff --git ')) { file = null; line = 0; out.push('', `=== ${row.slice(11)} ===`); continue; }
    if (row.startsWith('+++ ')) { file = row === '+++ /dev/null' ? null : row.slice(4).replace(/^b\//, ''); out.push(row); continue; }
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) { line = Number(hunk[1]); out.push(row); continue; }
    if (line === 0 || row.startsWith('\\')) { out.push(row); continue; } // file headers, "No newline" notes
    const touched = () => { if (file && !(changedLines[file] ??= []).includes(line)) changedLines[file].push(line); };
    // A removed line has no number of its own: record where it used to be, so a deletion counts as a change
    if (row.startsWith('-')) { touched(); out.push(`       - ${row.slice(1)}`); continue; }
    const added = row.startsWith('+');
    if (added) touched();
    out.push(`${`L${line}`.padEnd(6)} ${added ? '+' : ' '} ${row.slice(1)}`);
    line++;
  }
  return out.join('\n');
}

// ---------- hard constraints: facts, not opinions ----------

// First line of each added hunk, so every fact carries a real line number
function addedLines(file) {
  const out = tryGit('diff', '--no-color', '-U0', mergeBase, '--', file) ?? '';
  const lines = [];
  let line = 0;
  for (const row of out.split('\n')) {
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (row.startsWith('+') && !row.startsWith('+++')) lines.push({ line: line++, text: row.slice(1) });
    else if (!row.startsWith('-') && !row.startsWith('\\')) line++;
  }
  return lines;
}

const facts = [];
const fact = (file, line, severity, issue, evidence) => facts.push({ file, line, severity, issue, evidence, source: 'deterministic' });
const isProtected = (f) => /(^|\/)(schema|seed)\.sql$/.test(f) || /(^|\/)bookshelf\.db/.test(f) || /(^|\/)\.env(\.(?!example$)[\w.-]+)?$/.test(f);

for (const { status, file } of changed) {
  if (isProtected(file)) {
    const first = addedLines(file)[0];
    const what = status === 'D' ? 'deleted' : status === 'A' ? 'added' : 'modified';
    fact(file, first?.line ?? 1, 'high', `Protected file ${what}: the ticket forbids touching ${path.basename(file)}.`,
      first ? `Line ${first.line} now reads: ${first.text.trim().slice(0, 160)}` : `git reports status ${status} against ${base}.`);
  }
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) {
    if (status === 'D') fact(file, 1, 'high', 'Existing test file deleted.', `git reports status D against ${base}.`);
    for (const { line, text } of addedLines(file)) {
      if (/\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(/.test(text)) {
        fact(file, line, 'medium', 'Test disabled or narrowed with skip/only/todo.', text.trim().slice(0, 160));
      }
    }
  }
}

// Dependencies: compare the two package.json files as data
const readJson = (text) => { try { return JSON.parse(text); } catch { return null; } };
const before = readJson(tryGit('show', `${mergeBase}:package.json`) ?? '');
const after = existsSync('package.json') ? readJson(readFileSync('package.json', 'utf8')) : null;
if (before && after) {
  const pkgLines = readFileSync('package.json', 'utf8').split('\n');
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, version] of Object.entries(after[group] ?? {})) {
      const old = before[group]?.[name];
      if (old === version) continue;
      const line = pkgLines.findIndex((l) => l.includes(`"${name}"`)) + 1;
      fact('package.json', line || 1, 'high', old ? `Dependency ${name} changed version (${old} -> ${version}).` : `New dependency added: ${name}. The ticket forbids new dependencies.`,
        `${group}: "${name}": "${version}"`);
    }
  }
}

// ---------- spec and tests ----------

const spec = ['SPEC.md', 'spec.md', 'docs/SPEC.md'].find((p) => existsSync(p)) ?? null;

let tests = { ran: false, reason: 'skipped with --no-tests' };
if (runTests) {
  const scripts = after?.scripts ?? {};
  const command = process.env.TICKET_TO_MERGE_TEST_CMD || (scripts['test:run'] ? 'npm run test:run' : scripts.test ? 'npm test' : null);
  if (!command) tests = { ran: false, reason: 'no test script in package.json' };
  else if (!existsSync('node_modules')) tests = { ran: false, reason: 'node_modules is missing; run npm install to include test evidence' };
  else {
    const run = spawnSync(command, { shell: true, encoding: 'utf8', timeout: 170_000, env: { ...process.env, CI: '1' } });
    const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '').trim().split('\n');
    tests = { ran: true, command, passed: run.status === 0, output: output.slice(-(run.status === 0 ? 8 : 60)).join('\n') };
  }
}

// ---------- write the diff where the reviewers can read it ----------

mkdirSync('.ticket-to-merge', { recursive: true });
const exclude = tryGit('rev-parse', '--git-path', 'info/exclude');
try {
  if (exclude && !(existsSync(exclude) && readFileSync(exclude, 'utf8').includes('.ticket-to-merge'))) {
    mkdirSync(path.dirname(exclude), { recursive: true });
    appendFileSync(exclude, '\n.ticket-to-merge/\n');
  }
} catch { /* a read-only .git only means the folder shows up in git status */ }
writeFileSync('.ticket-to-merge/review.diff', `${annotate(diff)}\n`);
writeFileSync('.ticket-to-merge/changed-lines.json', `${JSON.stringify(changedLines)}\n`);

console.log(JSON.stringify({
  base,
  mergeBase: mergeBase.slice(0, 12),
  head: git('rev-parse', '--short=12', 'HEAD'),
  branch: tryGit('rev-parse', '--abbrev-ref', 'HEAD'),
  diffFile: '.ticket-to-merge/review.diff',
  diffLines: diff.split('\n').length,
  changedFiles: changed,
  spec,
  tests,
  facts,
}, null, 2));
