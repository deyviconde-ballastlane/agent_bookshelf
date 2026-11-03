#!/usr/bin/env node
// PreToolUse guardrail: blocks changes to the DB schema/seed and to the guardrail itself.
// Exit 2 blocks the tool call and shows stderr to Claude. Exit 1 would NOT block.
// Bypass battery: node --test tests/hooks/*.test.mjs
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const P = path.posix;

// Project-relative and lowercase (macOS paths are case-insensitive)
const PROTECTED_FILES = ['src/db/schema.sql', 'src/db/seed.sql', '.claude/settings.json', '.claude/settings.local.json'];
const PROTECTED_DIRS = ['.claude/hooks'];
// Deleting or moving one of these takes a protected file with it
const ANCESTORS = ['.', 'src', 'src/db', '.claude'];

// A single read-only command may touch protected files: no chaining, redirects or substitution
const READ_ONLY = /^\s*(cat|head|tail|less|more|wc|grep|egrep|rg|ls|stat|file|diff|sed\s+-n|git\s+(diff|log|show|status|blame))\b[^;&|<>`$]*$/;
const SED_IN_PLACE = /^\s*sed\b.*(\s-[a-z]*i|--in-place)/;
// Commands that write, delete or move whatever they are pointed at
const WRITERS = /\b(rm|rmdir|unlink|mv|cp|rsync|ln|shred|truncate|tee|dd|chmod)\b|\b(sed|perl)\b[^;&|]*\s-[a-z]*i|\bfind\b.*\s-(delete\b|(exec|execdir|ok)\s+(rm|mv|cp|sed|tee|truncate|ln|sh|bash|perl|python3?|node)\b)/;
// The target is only known at run time
const DYNAMIC = /[$`]|\beval\b|\bbase64\b/;

function block(reason) {
  process.stderr.write(`Blocked by .claude/hooks/protect-schema-and-seed.mjs: ${reason}\n`);
  process.exit(2);
}

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

// Normalized, project-relative, lowercase path ('.' is the project root)
function rel(p) {
  const s = slash(p).toLowerCase();
  const abs = P.isAbsolute(s) ? s : P.join(cwd, s);
  return P.relative(root, P.normalize(abs)) || '.';
}

const isProtected = (r) => PROTECTED_FILES.includes(r) || PROTECTED_DIRS.some((d) => r === d || r.startsWith(`${d}/`));
const isAncestor = (r) => ANCESTORS.includes(r) || /^\.\.(\/\.\.)*$/.test(r);

function globMatches(r, test) {
  const re = new RegExp(`^${r.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);
  return [...PROTECTED_FILES, ...PROTECTED_DIRS, ...ANCESTORS].some((c) => re.test(c) && test(c));
}

function touchesProtected(command) {
  // Undo quoting and escaping: sche''ma.sql, "se"ed.sql and sche\ma.sql all mean the same file
  const text = command.replace(/['"\\]/g, '').toLowerCase();
  if (/(schema|seed)\.sql|\.claude\/(settings|hooks)|protect-schema-and-seed/.test(text)) return true;
  // cd into a protected area, then use relative paths
  if (/\bcd\s+(\S*\/)?(db|src|\.claude)\/?(?=$|[\s;&|)])/.test(text)) return true;

  const writes = WRITERS.test(text);
  if (DYNAMIC.test(command) && (writes || /[>]\s*["']?[$`]/.test(command) || /sql|src|\bdb\b|\.claude/.test(text))) return true;

  for (const token of text.split(/[\s;&|()<>=]+/)) {
    if (!token || token.startsWith('-')) continue;
    const r = rel(token);
    const glob = /[*?[]/.test(r);
    if (glob ? globMatches(r, isProtected) : isProtected(r)) return true;
    if (writes && (glob ? globMatches(r, isAncestor) : isAncestor(r))) return true;
  }
  return false;
}

const tool = input.tool_name;
const args = input.tool_input ?? {};

if (tool === 'Bash') {
  const command = String(args.command ?? '');
  const readOnly = READ_ONLY.test(command) && !SED_IN_PLACE.test(command);
  if (touchesProtected(command) && !readOnly) {
    block(`this shell command could change a protected file: ${command}`);
  }
} else {
  const target = args.file_path ?? args.notebook_path;
  const paths = [rel(target)];
  if (target) paths.push(rel(slash(real(path.resolve(input.cwd || process.cwd(), String(target))))));
  const hit = paths.find(isProtected);
  if (hit) {
    block(`${hit} is protected. Schema/seed changes and guardrail edits need a human.`);
  }
}

process.exit(0);
