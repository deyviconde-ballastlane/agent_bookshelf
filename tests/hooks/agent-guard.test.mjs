// Bypass battery for .claude/hooks/agent-guard.mjs
// Feeds fake PreToolUse JSON to the guard with a role and checks the exit code: 2 = blocked, 0 = allowed.
// Run: node --test tests/hooks/*.test.mjs          (GUARD=<path> to test another copy)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const GUARD = process.env.GUARD || path.join(import.meta.dirname, '../../.claude/hooks/agent-guard.mjs');
const ROOT = '/repo';

function run(role, tool, toolInput) {
  const stdin = JSON.stringify({ tool_name: tool, tool_input: toolInput, cwd: ROOT });
  const args = role ? [GUARD, role] : [GUARD];
  return spawnSync('node', args, { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } }).status;
}

const bash = (command) => ['Bash', { command }];
const edit = (file_path) => ['Edit', { file_path }];
const write = (file_path) => ['Write', { file_path }];
const read = (file_path) => ['Read', { file_path }];

function expectAll(role, expected, cases) {
  const wrong = cases
    .map(([tool, toolInput]) => ({ call: `${tool} ${toolInput.command ?? toolInput.file_path}`, got: run(role, tool, toolInput) }))
    .filter(({ got }) => got !== expected);
  assert.deepEqual(wrong, [], `${role}: expected exit ${expected} for every case`);
}

const SNEAKY_SHELL = [
  bash('npm run test:run && rm -rf src'),
  bash('npm run test:run; git checkout .'),
  bash('npm run test:run | tee out.txt'),
  bash('npm run test:run > /tmp/x'),
  bash('npm run test:run $(touch x)'),
  bash('npm test'),
  bash('npm install'),
  bash('git status'),
  bash('sed -i "" s/a/b/ src/routes/api.ts'),
  bash('echo hi > src/routes/api.ts'),
  bash('node -e "require(\'fs\').writeFileSync(\'x\',\'\')"'),
  bash('npx vitest run tests/../src/x.test.ts'),
];

test('auditor: reads, nothing else', () => {
  expectAll('auditor', 0, [read('src/routes/api.ts'), ['Grep', { pattern: 'x' }], ['Glob', { pattern: '**/*.ts' }]]);
  expectAll('auditor', 2, [bash('npm run test:run'), edit('src/routes/api.ts'), write('tests/x.test.ts'), ['WebFetch', { url: 'x' }]]);
});

test('test-runner: only the full suite, never edits', () => {
  expectAll('test-runner', 0, [bash('npm run test:run'), bash('  npm run test:run  ')]);
  expectAll('test-runner', 2, [
    ...SNEAKY_SHELL,
    bash('npx vitest run tests/db.test.ts'),
    edit('src/routes/api.ts'),
    write('tests/x.test.ts'),
    edit('package.json'),
  ]);
});

test('test-writer: writes only under tests/, runs only tests', () => {
  expectAll('test-writer', 0, [
    write('tests/audit/api.test.ts'),
    edit('/repo/tests/routes/api.test.ts'),
    bash('npm run test:run'),
    bash('npx vitest run tests/audit/api-error-codes.test.ts'),
  ]);
  expectAll('test-writer', 2, [
    ...SNEAKY_SHELL,
    edit('src/routes/api.ts'),
    write('tests/../src/routes/api.ts'),
    write('tests/hooks/agent-guard.test.mjs'),
    edit('.claude/agents/test-writer.md'),
    edit('vitest.config.ts'),
    write('/etc/passwd'),
  ]);
});

test('fixer: writes only under src/, never tests or schema', () => {
  expectAll('fixer', 0, [edit('src/routes/api.ts'), edit('/repo/src/models/book.ts'), bash('npx vitest run tests/audit/x.test.ts')]);
  expectAll('fixer', 2, [
    ...SNEAKY_SHELL,
    edit('tests/audit/api-error-codes.test.ts'),
    edit('src/db/schema.sql'),
    edit('src/db/seed.sql'),
    edit('SRC/DB/SCHEMA.SQL'),
    edit('.claude/skills/audit-fix/SKILL.md'),
    edit('README.md'),
  ]);
});

test('fails closed on unknown role, missing role or bad input', () => {
  assert.equal(run('hacker', 'Read', { file_path: 'x' }), 2);
  assert.equal(run('implementer', 'Read', { file_path: 'x' }), 2);
  assert.equal(run(undefined, 'Read', { file_path: 'x' }), 2);
  const bad = spawnSync('node', [GUARD, 'auditor'], { input: 'not json', encoding: 'utf8' }).status;
  assert.equal(bad, 2);
});
