#!/usr/bin/env node
// PreToolUse guardrail for the week 2 subagents. Each agent registers it in its own frontmatter
// with its role as the argument: node .claude/hooks/agent-guard.mjs <role>
// Allowlist, not denylist: anything a role is not explicitly allowed to do is blocked.
// Exit 2 blocks the tool call and shows stderr to the agent. Exit 1 would NOT block.
// Bypass battery: node --test tests/hooks/*.test.mjs
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const P = path.posix;

// One test command, nothing chained, redirected or substituted
const TEST_SUITE = /^\s*npm run test:run\s*$/;
const ONE_TEST_FILE = /^\s*npx vitest run tests\/(?!.*\.\.)[\w./-]+\.test\.ts\s*$/;

const ROLES = {
  auditor: { bash: [], write: [] },
  'test-runner': { bash: [TEST_SUITE], write: [] },
  'test-writer': { bash: [TEST_SUITE, ONE_TEST_FILE], write: ['tests/'] },
  fixer: { bash: [TEST_SUITE, ONE_TEST_FILE], write: ['src/'] },
};
// Never writable by any agent, even inside an allowed folder
const NEVER = ['tests/hooks/', 'src/db/schema.sql', 'src/db/seed.sql'];
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob'];
const WRITE_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

const role = process.argv[2];

function block(reason) {
  process.stderr.write(
    `Blocked by agent-guard (${role ?? 'no role'}): ${reason}\n` +
      'Do not try another way around this. Stop and report it to the orchestrator.\n',
  );
  process.exit(2);
}

const policy = ROLES[role];
if (!policy) block('unknown role (failing closed).');

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  block('could not parse hook input (failing closed).');
}

const slash = (p) => String(p ?? '').replace(/\\/g, '/');
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
const root = slash(real(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd())).toLowerCase();
const cwd = slash(real(input.cwd || root)).toLowerCase();

// Normalized, project-relative, lowercase path. Outside the project starts with '..'
function rel(p) {
  const s = slash(p).toLowerCase();
  const abs = P.isAbsolute(s) ? s : P.join(cwd, s);
  return P.relative(root, P.normalize(abs)) || '.';
}

// Paths are compared lowercase (macOS paths are case-insensitive)
const inside = (r, entry) => {
  const e = entry.toLowerCase();
  return e.endsWith('/') ? r.startsWith(e) : r === e;
};

const tool = input.tool_name;
const args = input.tool_input ?? {};

if (READ_ONLY_TOOLS.includes(tool)) process.exit(0);

if (tool === 'Bash') {
  const command = String(args.command ?? '');
  if (!policy.bash.some((re) => re.test(command))) {
    const allowed = policy.bash.length ? policy.bash.map((re) => re.source).join(' | ') : 'none';
    block(`shell command not allowed for this role: ${command}\nAllowed: ${allowed}`);
  }
  process.exit(0);
}

if (WRITE_TOOLS.includes(tool)) {
  const target = args.file_path ?? args.notebook_path;
  if (!target) block('write without a file path.');
  // Check both the path as given and where it really points (symlinks)
  const paths = [rel(target), rel(slash(real(path.resolve(input.cwd || process.cwd(), String(target)))))];
  for (const r of paths) {
    if (NEVER.some((n) => inside(r, n))) block(`${r} is never writable by an agent.`);
    if (!policy.write.some((w) => inside(r, w))) {
      block(`${r} is outside what this role may write (${policy.write.join(', ') || 'nothing'}).`);
    }
  }
  process.exit(0);
}

block(`tool ${tool} is not allowed for this role.`);
