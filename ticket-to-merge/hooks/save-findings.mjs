#!/usr/bin/env node
// SubagentStop hook for the review-verifier: saves its final message, the verified findings, to
// .ticket-to-merge/verifier.json. The last step of /review-pr reads that file with a plain command,
// so the coordinator never re-types the findings and needs no permission to write a file.
// It never blocks: any failure here only means the coordinator falls back to printing the array itself.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (String(input.agent_type ?? '').endsWith(':review-verifier')) {
    const dir = path.join(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd(), '.ticket-to-merge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'verifier.json'), String(input.last_assistant_message ?? ''));
  }
} catch { /* never block the verifier */ }
process.exit(0);
