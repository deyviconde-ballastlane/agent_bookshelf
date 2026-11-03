// Bypass battery for .claude/hooks/protect-schema-and-seed.mjs
// Feeds fake PreToolUse JSON to the hook and checks the exit code: 2 = blocked, 0 = allowed.
// Run: node --test tests/hooks/*.test.mjs          (HOOK=<path> to test another copy)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const HOOK = process.env.HOOK || path.join(import.meta.dirname, '../../.claude/hooks/protect-schema-and-seed.mjs');
const ROOT = '/repo';
const counts = { blocked: 0, allowed: 0 };

function run(tool, toolInput, root = ROOT) {
  const stdin = tool ? JSON.stringify({ tool_name: tool, tool_input: toolInput, cwd: root }) : toolInput;
  return spawnSync('node', [HOOK], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } }).status;
}

const bash = (command) => ['Bash', { command }];
const edit = (file_path) => ['Edit', { file_path }];
const write = (file_path) => ['Write', { file_path }];

function expectAll(expected, cases) {
  const wrong = cases
    .map(([tool, toolInput]) => ({ call: toolInput.command ?? toolInput.file_path ?? toolInput.notebook_path ?? toolInput, got: run(tool, toolInput) }))
    .filter(({ got }) => got !== expected);
  counts[expected === 2 ? 'blocked' : 'allowed'] += cases.length;
  assert.deepEqual(wrong, [], `expected exit ${expected} for every case`);
}

// ---------- must block ----------

test('blocks direct edits through the file tools', () => expectAll(2, [
  edit('src/db/schema.sql'),
  write('src/db/seed.sql'),
  ['MultiEdit', { file_path: '/repo/src/db/schema.sql' }],
  ['NotebookEdit', { notebook_path: 'src/db/seed.sql' }],
]));

test('blocks path tricks: .., ./, case and Windows slashes', () => expectAll(2, [
  edit('src/db/../db/schema.sql'),
  edit('./src/./db/schema.sql'),
  edit('/repo/src/routes/../db/seed.sql'),
  edit('src/db/Schema.SQL'),
  write('src\\db\\seed.sql'),
]));

test('blocks an edit through a symlink', () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'hook-')));
  mkdirSync(path.join(root, 'src/db'), { recursive: true });
  writeFileSync(path.join(root, 'src/db/schema.sql'), '');
  symlinkSync(path.join(root, 'src/db/schema.sql'), path.join(root, 'notes.sql'));
  try {
    assert.equal(run('Edit', { file_path: path.join(root, 'notes.sql') }, root), 2);
    counts.blocked += 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('blocks plain shell writes', () => expectAll(2, [
  bash("sed -i '' 's/TEXT/BLOB/' src/db/schema.sql"),
  bash('echo "-- x" >> src/db/seed.sql'),
  bash('printf x | tee src/db/seed.sql'),
  bash('cp /tmp/x src/db/schema.sql'),
  bash('truncate -s 0 src/db/seed.sql'),
  bash('ln -sf /tmp/x src/db/schema.sql'),
  bash('cat src/db/seed.sql > /tmp/a && mv /tmp/a src/db/seed.sql'),
  bash('git checkout HEAD~1 -- src/db/schema.sql'),
  bash("sed -n -i 's/a/b/' src/db/schema.sql"),
]));

test('survives bypass attempts: quoting and escaping', () => expectAll(2, [
  bash("sed -i '' s/a/b/ src/db/sche''ma.sql"),
  bash('echo x >> "src/db/"se"ed.sql"'),
  bash('echo x >> src/db/sche\\ma.sql'),
  bash("echo x >> $'src/db/\\x73chema.sql'"),
]));

test('survives bypass attempts: variables and command substitution', () => expectAll(2, [
  bash('f=sche; echo x >> src/db/${f}ma.sql'),
  bash('d=src/db; rm -rf $d'),
  bash('rm -rf $(echo src)/db'),
  bash('echo x > $(echo c3JjL2RiL3NjaGVtYS5zcWw= | base64 -d)'),
  bash('tee $(cat /tmp/target) < /tmp/x'),
]));

test('survives bypass attempts: deleting or moving a parent directory', () => expectAll(2, [
  bash('rm -rf src/db'),
  bash('rm -rf src'),
  bash('rm -rf .'),
  bash('rm -rf *'),
  bash('rm -rf ..'),
  bash('mv src/db /tmp/x'),
  bash('rm -rf src/routes/../db'),
  bash('rm -rf /repo/src'),
  bash("find . -name '*.sql' -delete"),
  bash('rsync -a --delete /tmp/empty/ src/'),
]));

test('survives bypass attempts: cd, then a relative path', () => expectAll(2, [
  bash('cd src/db && rm *.sql'),
  bash('cd src && rm -rf db'),
  bash('cd ./src/db/ && echo x >> seed.sql'),
  bash('cd .claude && rm -rf hooks'),
]));

test('survives bypass attempts: globs', () => expectAll(2, [
  bash('cp /tmp/x src/db/*.sql'),
  bash('rm src/d?/s*.sql'),
  bash('rm -f src/db/[s]chema.sql'),
]));

test('survives bypass attempts: interpreters with inline code', () => expectAll(2, [
  bash("node -e \"require('fs').appendFileSync('src/db/schema.sql','x')\""),
  bash("python3 -c \"open('src/db/seed.sql','w').write('')\""),
  bash("perl -pi -e 's/a/b/' src/db/schema.sql"),
]));

test('blocks attempts to switch the guardrail off', () => expectAll(2, [
  edit('.claude/settings.json'),
  write('.claude/settings.local.json'),
  write('.claude/hooks/protect-schema-and-seed.mjs'),
  write('.claude/hooks/new-hook.mjs'),
  bash('rm .claude/hooks/protect-schema-and-seed.mjs'),
  bash("echo '{}' > .claude/settings.json"),
  bash('mv .claude /tmp/x'),
  bash('rm -rf .claude'),
]));

test('fails closed on unreadable input', () => expectAll(2, [[null, 'not json']]));

// ---------- must allow ----------

test('allows reading the protected files', () => expectAll(0, [
  bash('cat src/db/schema.sql'),
  bash('head -20 src/db/seed.sql'),
  bash('grep -in create src/db/schema.sql'),
  bash('sed -n 1,20p src/db/schema.sql'),
  bash('wc -l src/db/seed.sql'),
  bash('git diff src/db/schema.sql'),
  bash('git log --oneline -- src/db/seed.sql'),
  bash('cat .claude/settings.json'),
  bash('ls src/db'),
]));

test('allows everyday work', () => expectAll(0, [
  bash('npm run test:run'),
  bash('npm run build'),
  bash('git status'),
  bash('git commit -m "Update schema docs"'),
  bash('rm -rf dist'),
  bash('rm -rf node_modules'),
  bash('node --test tests/hooks/*.test.mjs'),
  bash('npx vitest run tests/models/book.test.ts'),
  bash('echo $HOME'),
  bash("find . -name '*.ts' -not -path './node_modules/*'"),
  bash('cd src/routes && ls'),
  edit('src/routes/api.ts'),
  edit('src/db/index.ts'),
  write('tests/models/user.test.ts'),
  edit('README.md'),
  write('src/db/migrations/002-add-genre.sql'),
]));

after(() => console.log(`# ${counts.blocked} attacks must block, ${counts.allowed} legitimate calls must pass`));
