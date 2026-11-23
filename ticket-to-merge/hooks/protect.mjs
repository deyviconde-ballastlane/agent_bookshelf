#!/usr/bin/env node
// PreToolUse guardrail for the ticket-to-merge plugin.
//   - No tool may change the database, the seed, the schema, or the guardrail itself.
//   - No tool may read or change .env (secrets).
// Exit 2 blocks the tool call and shows stderr to Claude. Exit 1 would NOT block.
// Bypass battery: node --test ticket-to-merge/tests/hook-bypass.test.mjs
import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const P = path.posix;

function block(reason) {
  process.stderr.write(`Blocked by the ticket-to-merge guardrail: ${reason}\n`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  block('could not parse the hook input (failing closed).');
}

const slash = (p) => String(p ?? '').replace(/\\/g, '/');
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
// Lowercase everywhere: macOS and Windows paths are case-insensitive
const norm = (p) => P.normalize(slash(p)).toLowerCase().replace(/(.)\/$/, '$1');

const root = norm(real(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()));
const cwd = norm(real(input.cwd || root));
const home = norm(homedir());
const pluginRoot = norm(real(path.resolve(import.meta.dirname, '..')));

// Absolute, normalized, lowercase
function abs(p, base = cwd) {
  let s = slash(p).toLowerCase();
  if (s === '~' || s.startsWith('~/')) s = home + s.slice(1);
  return norm(P.isAbsolute(s) ? s : P.join(base, s));
}

// ---------- what is protected ----------

const NO_WRITE_FILES = ['src/db/schema.sql', 'src/db/seed.sql', '.claude/settings.json', '.claude/settings.local.json']
  .map((f) => P.join(root, f));
// The guardrail protects itself: editing these would switch it off
const NO_WRITE_DIRS = [P.join(pluginRoot, 'hooks'), P.join(pluginRoot, '.claude-plugin')];
const DB = P.join(root, 'bookshelf.db');
const ENV = P.join(root, '.env');

const isEnv = (a) => {
  const b = P.basename(a);
  return b === '.env' || (b.startsWith('.env.') && b !== '.env.example');
};
const isDb = (a) => P.basename(a).startsWith('bookshelf.db');
const isGuarded = (a) =>
  NO_WRITE_FILES.includes(a) || isDb(a) || NO_WRITE_DIRS.some((d) => a === d || a.startsWith(`${d}/`));

const GUARDED = [...NO_WRITE_FILES, ...NO_WRITE_DIRS, DB, `${DB}-shm`, `${DB}-wal`];
const ENVS = [ENV, `${ENV}.local`];
// Deleting or moving one of these directories takes a protected file with it
const ANCESTORS = [...new Set([...GUARDED, ENV].flatMap((k) => {
  const dirs = [];
  for (let d = P.dirname(k); ; d = P.dirname(d)) {
    dirs.push(d);
    if (d === '/' || d === '.') break;
  }
  return dirs;
}))];
const isAncestor = (a) => ANCESTORS.includes(a);

function globHits(a, candidates) {
  let re;
  try {
    re = new RegExp(`^${a.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);
  } catch {
    return false; // not a real glob, e.g. the "[" of a shell test
  }
  return candidates.some((c) => re.test(c));
}

// ---------- shell commands ----------

// One simple command (no chaining, redirects, substitution or second line) that only reads
const SIMPLE = /^[^;&|<>`$\n\r]*$/;
const READERS = /^\s*(?:(?:cat|head|tail|wc|grep|egrep|rg|ls|stat|diff)\b|sed\s+-n\s+['"]?\d+(?:,\d+)?p['"]?\s|git\s+(?:diff|log|show|status|blame)\b)/;
const READER_ESCAPES = /--output|--pre\b|--ext-diff/;
const isReadOnly = (command) => SIMPLE.test(command) && READERS.test(command) && !READER_ESCAPES.test(command);

// Commands that write, delete or move whatever they are pointed at
const WRITERS = /\b(rm|rmdir|unlink|mv|cp|rsync|ln|shred|truncate|tee|dd|chmod|install)\b|\b(sed|perl)\b[^;&|]*\s-[a-z]*i|\bfind\b.*\s-(delete\b|(exec|execdir|ok)\s+(rm|mv|cp|sed|tee|truncate|ln|sh|bash|perl|python3?|node)\b)/;
// The target is only known at run time
const DYNAMIC = /[$`]|\beval\b|\bbase64\b/;
const DYNAMIC_HINTS = /sql|src|\bdb\b|\.claude|\benv\b|hooks|plugin/;
// Code passed inline to an interpreter can build any path, so it cannot be vetted
const INLINE_CODE = /\b(node|deno|bun|python3?|perl|ruby|php|sh|bash|zsh|osascript)\b[^;&|\n]*(\s(-e|-c|-r|-p|--eval|eval)\b|<<)|\|\s*(node|python3?|perl|ruby|sh|bash|zsh)\b/;
const FS_WRITE = /write|append|unlink|rmsync|\brm\b|rename|copyfile|cpsync|truncate|createwritestream|open\(|shutil|os\.remove|>/;
const NAME_HINTS = ['schema.sql', 'seed.sql', 'bookshelf.db', '.claude/settings', 'hooks.json', 'protect.mjs', '.claude-plugin'];
// ".env" as its own word: matches `cat .env` and `>.env.local`, not `process.env.PORT` or `.env.example`
const ENV_WORD = /(^|[\s/=<>(:,])\.env(\.(?!example(?![\w.-]))[\w.-]+)?(?=$|[\s;&|)<>,:])/;

// Commit and PR messages are data, not code. Drop them so a message that mentions seed.sql is not a
// false alarm. Only literal forms are dropped: "$(rm …)" inside double quotes stays visible.
function stripMessages(command) {
  const literal = String.raw`(?:'[^']*'|"[^"$\x60\\]*"|"\$\(cat\s*<<-?\s*'(\w+)'\n[\s\S]*?\n[ \t]*\2[ \t]*\n?[ \t]*\)")`;
  const re = new RegExp(String.raw`((?:^|[;&|\n])\s*(?:git|gh)\b[^;&|\n]*?(?:-m|--message|--body|--title)[ =]\s*)${literal}`);
  let previous;
  do {
    previous = command;
    command = command.replace(re, '$1MSG');
  } while (command !== previous);
  return command;
}

// Returns 'env', 'guarded' or null
function scan(rawCommand) {
  const command = stripMessages(rawCommand);
  // Undo quoting and escaping: se''ed.sql, "se"ed.sql and se\ed.sql all mean the same file
  const text = command.replace(/['"\\]/g, '').toLowerCase();

  if (ENV_WORD.test(text)) return 'env';

  // After `cd dir`, relative paths resolve from dir: check every token against every directory visited
  const bases = [cwd];
  for (const m of text.matchAll(/\b(?:cd|pushd)\s+([^\s;&|)]+)/g)) bases.push(abs(m[1], bases.at(-1)));

  const writes = WRITERS.test(text);
  let guarded = NAME_HINTS.some((h) => text.includes(h));
  if (DYNAMIC.test(command) && (writes || /[>]\s*["']?[$`]/.test(command) || DYNAMIC_HINTS.test(text))) guarded = true;
  if (INLINE_CODE.test(text) && FS_WRITE.test(text)) guarded = true;
  // -x / -X also delete ignored files: bookshelf.db and .env
  if (/\bgit\s+clean\b[^;&|]*\s-[a-z]*x/.test(text)) guarded = true;

  for (const token of text.split(/[\s;&|()<>=]+/)) {
    if (!token || token.startsWith('-')) continue;
    const glob = /[*?[]/.test(token);
    for (const base of bases) {
      const a = abs(token, base);
      if (isEnv(a) || (glob && P.basename(a).startsWith('.') && globHits(a, ENVS))) return 'env';
      if (glob ? globHits(a, GUARDED) : isGuarded(a)) guarded = true;
      if (writes && (glob ? globHits(a, ANCESTORS) : isAncestor(a))) guarded = true;
    }
  }
  return guarded ? 'guarded' : null;
}

// ---------- role fences ----------

// Plugin agents ignore `hooks:` and `permissionMode:` in their own frontmatter, so each role's fence
// lives here, keyed on the agent_type Claude Code puts in the hook input ("ticket-to-merge:implementer").
// Allowlist, not denylist: what a role is not explicitly allowed to do is blocked.
const WRITE_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
const ROLES = {
  'test-writer': { write: ['tests/'], bash: true },
  implementer: { write: ['src/', 'readme.md'], bash: true },
};
const REVIEWER = { write: [], bash: false };
const TAIL = String.raw`(\s*2>&1)?(\s*\|\s*(tail|head)(\s+-n)?\s+-?\d+)?\s*$`;
const ROLE_BASH = [
  new RegExp(String.raw`^\s*npm run test:run${TAIL}`),
  new RegExp(String.raw`^\s*npx vitest run(\s+tests/(?!\S*\.\.)[\w./-]+)*${TAIL}`),
  new RegExp(String.raw`^\s*npx tsc --noEmit${TAIL}`),
];

function pluginName() {
  try {
    return JSON.parse(readFileSync(path.join(import.meta.dirname, '../.claude-plugin/plugin.json'), 'utf8')).name;
  } catch {
    return 'ticket-to-merge';
  }
}

function fence(tool, args) {
  const prefix = `${pluginName()}:`;
  const agentType = String(input.agent_type ?? '');
  if (!agentType.startsWith(prefix)) return; // the main thread and other agents only get the shared rules
  const role = agentType.slice(prefix.length);
  const policy = role.startsWith('review-') ? REVIEWER : ROLES[role];
  if (!policy) return;
  const stop = 'Do not try another way around this. Stop and report it to the orchestrator.';

  if (tool === 'Bash') {
    const command = String(args.command ?? '');
    if (!policy.bash) block(`${role} is read-only and may not run shell commands. ${stop}`);
    if (!ROLE_BASH.some((re) => re.test(command)) && !isReadOnly(command)) {
      block(`${role} may only run: npm run test:run | npx vitest run tests/<file> | npx tsc --noEmit | one read-only command (cat, grep, ls, git diff). Not: ${command}\n${stop}`);
    }
  } else if (WRITE_TOOLS.includes(tool)) {
    const target = args.file_path ?? args.notebook_path;
    const candidates = [abs(target), norm(real(path.resolve(input.cwd || process.cwd(), String(target))))];
    const allowed = (a) => policy.write.some((w) => {
      const entry = P.join(root, w); // keeps the trailing slash of a directory entry
      return w.endsWith('/') ? a.startsWith(entry) : a === entry;
    });
    if (!candidates.every(allowed)) {
      block(`${role} may only write under: ${policy.write.join(', ') || 'nothing (read-only role)'}. Not: ${target}\n${stop}`);
    }
  }
}

// ---------- decision ----------

try {
  const tool = input.tool_name;
  const args = input.tool_input ?? {};

  fence(tool, args);

  if (tool === 'Bash') {
    const command = String(args.command ?? '');
    const hit = scan(command);
    if (hit === 'env') block(`.env holds secrets and may not be read or changed. Command: ${command}`);
    if (hit === 'guarded' && !isReadOnly(command)) {
      block(`this command could change a protected file (database, seed, schema or the guardrail). Command: ${command}`);
    }
  } else if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const target = args.file_path ?? args.notebook_path;
    if (target) {
      // The path as given, and where it really points (symlinks)
      const candidates = [abs(target), norm(real(path.resolve(input.cwd || process.cwd(), String(target))))];
      if (candidates.some(isEnv)) block('.env holds secrets and may not be read or changed.');
      if (tool !== 'Read' && candidates.some(isGuarded)) {
        block(`${target} is protected. Database, seed, schema and guardrail changes need a human.`);
      }
    }
  }
} catch (error) {
  block(`the guardrail crashed (failing closed): ${error?.message ?? error}`);
}

process.exit(0);
