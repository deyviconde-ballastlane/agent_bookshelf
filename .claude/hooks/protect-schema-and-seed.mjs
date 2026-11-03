#!/usr/bin/env node
// PreToolUse guardrail: blocks changes to the DB schema/seed and to the guardrail itself.
// Exit 2 blocks the tool call and shows stderr to Claude. Exit 1 would NOT block.
import { readFileSync } from 'node:fs';

const PROTECTED_PATHS = [
  /(^|\/)src\/db\/schema\.sql$/,
  /(^|\/)src\/db\/seed\.sql$/,
  /(^|\/)\.claude\/settings(\.local)?\.json$/,
  /(^|\/)\.claude\/hooks\//,
];
// A shell command that mentions a protected file, or globs inside src/db/
const BASH_TARGETS = /(schema|seed)\.sql|src\/db\/[^\s'"]*[*?[]|\.claude\/(settings|hooks)/;
// The only shell commands allowed to touch them: single read-only commands, no redirects or chaining
const READ_ONLY = /^\s*(cat|head|tail|less|wc|grep|rg|git (diff|log|show|status|blame))\b[^;&|<>`$]*$/;

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

const tool = input.tool_name;
const args = input.tool_input ?? {};
const normalize = (p) => String(p ?? '').replace(/\\/g, '/');

if (tool === 'Bash') {
  const command = normalize(args.command);
  if (BASH_TARGETS.test(command) && !READ_ONLY.test(command)) {
    block(`this shell command touches a protected file: ${command}`);
  }
} else {
  const path = normalize(args.file_path ?? args.notebook_path);
  if (PROTECTED_PATHS.some((re) => re.test(path))) {
    block(`${path} is protected. Schema/seed changes and guardrail edits need a human.`);
  }
}

process.exit(0);
