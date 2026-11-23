#!/usr/bin/env node
// SubagentStop gate: the implementer may not stop while the test suite is red.
// Exit 2 keeps the agent running and shows it stderr (the failing tests).
// Bounded: after MAX_BLOCKS it lets go, and the orchestrator reports the red suite instead of looping.
// The agent can also stop on purpose by starting its last message with "BLOCKED:".
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MAX_BLOCKS = 3;
const TEST_COMMAND = process.env.TICKET_TO_MERGE_TEST_CMD || 'npm run test:run';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // nothing to gate without input
}

if (!String(input.agent_type ?? '').endsWith(':implementer')) process.exit(0);
if (String(input.last_assistant_message ?? '').trimStart().startsWith('BLOCKED:')) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const run = spawnSync(TEST_COMMAND, { cwd, shell: true, encoding: 'utf8', timeout: 150_000 });
if (run.status === 0) process.exit(0);

const counter = path.join(tmpdir(), `ticket-to-merge-gate-${String(input.agent_id ?? 'agent').replace(/\W/g, '')}`);
let blocks = 0;
try { blocks = Number(readFileSync(counter, 'utf8')) || 0; } catch { /* first block */ }
if (blocks >= MAX_BLOCKS) {
  process.stderr.write(`ticket-to-merge gate: suite still red after ${MAX_BLOCKS} blocks, letting the agent stop.\n`);
  process.exit(0);
}
writeFileSync(counter, String(blocks + 1));

const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
process.stderr.write(
  `ticket-to-merge gate: \`${TEST_COMMAND}\` is failing, so you are not done (block ${blocks + 1} of ${MAX_BLOCKS}).\n` +
    'Fix the implementation, not the tests. If a test contradicts the spec, stop with a message that starts with "BLOCKED:".\n\n' +
    `${output}\n`,
);
process.exit(2);
