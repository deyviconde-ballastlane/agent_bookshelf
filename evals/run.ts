// Week 3 eval: can the auditor tell which requests break CLAUDE.md rule 5?
//
//   npx tsx evals/run.ts                    ground truth only (free, no model)
//   npx tsx evals/run.ts <model> [<model>]  ask each model, grade it, print pass rate and cost
//
// Task    = one HTTP request from cases.json
// Outcome = what the real API answers (not what anyone claims)
// Grader  = code: the model's verdict must equal the outcome
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import app from '../src/server.js';
import { closeDb, initDb } from '../src/db/index.js';

type Verdict = 'VIOLATES' | 'OK';
type Case = {
  id: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: unknown;
  raw?: string; // a body sent as-is (malformed JSON)
  expect: number; // the status rule 5 demands
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cases: Case[] = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));

// 1. Ground truth: fire each request at the real app, on a fresh database
async function actualStatus(c: Case): Promise<number> {
  const db = join(tmpdir(), `eval-${process.pid}-${c.id}.db`);
  rmSync(db, { force: true });
  await initDb(db);
  try {
    let req = request(app)[c.method](c.path);
    if (c.raw !== undefined) req = req.set('Content-Type', 'application/json').send(c.raw);
    else if (c.body !== undefined) req = req.send(c.body as object);
    return (await req).status;
  } finally {
    closeDb();
    rmSync(db, { force: true });
  }
}

// 2. The question for the model. It never sees `expect` or the real status.
const describe = (c: Case) =>
  `${c.id}  ${c.method.toUpperCase()} ${c.path}` +
  (c.raw !== undefined ? `  raw body: ${c.raw}` : c.body !== undefined ? `  ${JSON.stringify(c.body)}` : '');

const prompt = `You are a read-only code auditor. Do not edit or run anything; reason from the code.

Rule (CLAUDE.md rule 5): JSON API errors are 400 invalid input, 404 not found, 409 conflict.
Success is 200, 201 on create, 204 on delete. A 500 is never acceptable.

Scope: src/routes/api.ts. Read whatever else you need to be sure (src/models/, src/db/, src/server.ts).

Each case below is one HTTP request sent to a fresh database (schema + seed).
Decide what the code does today with that request:
- VIOLATES: the API answers 500, or a status other than the one the rule demands for that request
  (for example 201 when something the request points at does not exist).
- OK: the API answers with exactly the status the rule demands.

${cases.map(describe).join('\n')}

Answer with only a JSON object that maps every case id to "VIOLATES" or "OK".`;

function ask(model: string): Promise<{ verdicts: Record<string, Verdict>; cost: number; seconds: number; session: string }> {
  const args = ['-p', prompt, '--model', model, '--tools', 'Read,Grep,Glob', '--output-format', 'json', '--max-budget-usd', '2'];
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', () => {
      try {
        const r = JSON.parse(out);
        const text = String(r.result);
        const verdicts = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
        resolve({ verdicts, cost: r.total_cost_usd, seconds: r.duration_ms / 1000, session: r.session_id });
      } catch {
        reject(new Error(`${model}: could not read the answer:\n${out.slice(0, 500)}`));
      }
    });
  });
}

// Run
const quiet = console.error;
console.error = () => {}; // the app logs a stack trace on every 500
const truth: Record<string, Verdict> = {};
const actual: Record<string, number> = {};
for (const c of cases) {
  actual[c.id] = await actualStatus(c);
  truth[c.id] = actual[c.id] === c.expect ? 'OK' : 'VIOLATES';
}
console.error = quiet;

const bad = cases.filter((c) => truth[c.id] === 'VIOLATES');
const good = cases.filter((c) => truth[c.id] === 'OK');
console.log(`Ground truth from the real API: ${cases.length} cases, ${bad.length} violate rule 5, ${good.length} are fine\n`);

const models = process.argv.slice(2);
if (models.length === 0) {
  for (const c of cases) console.log(`${truth[c.id].padEnd(9)} got ${actual[c.id]}, rule wants ${c.expect}  ${describe(c)}`);
  process.exit(0);
}

console.log(`Asking ${models.join(' and ')}...\n`);
const answers = await Promise.all(models.map(ask));

mkdirSync(join(here, 'results'), { recursive: true });
console.log('MODEL'.padEnd(20), 'PASS'.padEnd(12), 'BUGS CAUGHT'.padEnd(13), 'NO FALSE ALARM'.padEnd(16), 'COST'.padEnd(8), 'TIME');
models.forEach((model, i) => {
  const { verdicts, cost, seconds, session } = answers[i];
  const pass = (c: Case) => verdicts[c.id] === truth[c.id]; // a missing verdict fails
  const n = (list: Case[]) => `${list.filter(pass).length}/${list.length}`;
  const failed = cases.filter((c) => !pass(c));
  console.log(
    model.padEnd(20),
    `${n(cases)} ${Math.round((100 * (cases.length - failed.length)) / cases.length)}%`.padEnd(12),
    n(bad).padEnd(13),
    n(good).padEnd(16),
    `$${cost.toFixed(2)}`.padEnd(8),
    `${Math.round(seconds)}s`,
  );
  for (const c of failed) console.log(`   wrong: said ${verdicts[c.id] ?? 'nothing'}, API returns ${actual[c.id]}  ${describe(c)}`);
  writeFileSync(
    join(here, 'results', `${model}.json`),
    JSON.stringify({ model, session, cost, seconds, passed: cases.length - failed.length, total: cases.length, cases: cases.map((c) => ({ id: c.id, request: describe(c), actual: actual[c.id], truth: truth[c.id], verdict: verdicts[c.id] ?? null, pass: pass(c) })) }, null, 2) + '\n',
  );
});
