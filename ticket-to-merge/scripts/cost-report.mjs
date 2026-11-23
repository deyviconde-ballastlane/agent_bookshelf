#!/usr/bin/env node
// Turns `claude -p --output-format json` results into the capstone cost table.
// total_cost_usd and modelUsage are the session's own accounting, the same numbers /usage shows,
// and they include the subagents the session spawned.
// Usage: node cost-report.mjs Build=build.json Review=review.json "Fix loop=fix-loop.json"
import { readFileSync } from 'node:fs';

const rows = process.argv.slice(2).map((pair) => {
  const [stage, file] = pair.split('=');
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const usage = Object.entries(r.modelUsage ?? {});
  const sum = (key) => usage.reduce((total, [, m]) => total + (m[key] ?? 0), 0);
  const read = sum('cacheReadInputTokens');
  const input = read + sum('cacheCreationInputTokens') + sum('inputTokens');
  return {
    stage,
    cost: r.total_cost_usd,
    cacheHit: input ? Math.round((100 * read) / input) : 0,
    models: usage.map(([model, m]) => `${model.replace(/^claude-/, '')} $${m.costUSD.toFixed(2)}`).join(', '),
    agents: Object.entries(r.subagent_stats?.by_type ?? {}).map(([type, n]) => `${type.split(':').pop()} ×${n}`).join(', '),
  };
});

console.log('| Stage | Cost | Cache hit | Models | Agents |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.stage} | $${r.cost.toFixed(2)} | ${r.cacheHit}% | ${r.models} | ${r.agents || '-'} |`);
console.log(`| **Total, one ticket** | **$${rows.reduce((t, r) => t + r.cost, 0).toFixed(2)}** | | | |`);
