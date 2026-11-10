# Week 2: multi-agent flow, cost before and after

**Task: audit the JSON API against CLAUDE.md rule 5 (errors are 400/404/409, never 500), prove each finding with a failing test, and fix the confirmed ones.**

**Flow:** `/audit-fix` (`.claude/skills/audit-fix/`) chains four generic subagents from `.claude/agents/` in a pipeline:

```
auditor  →  test-writer  →  fixer  →  test-runner
(reads)     (proves)        (fixes)   (verifies)
```

**Lever:** model per subagent. Nothing else changed between runs: same base commit, same command, same session model (Opus 5.5), auto mode on in both.

```
/audit-fix "CLAUDE.md rule 5: API errors use 400/404/409, never 500" src/routes/api.ts
```

**Guardrails (added after the runs):** each agent's frontmatter has a `PreToolUse` hook that calls `.claude/hooks/agent-guard.mjs` with its role. The guard is an allowlist: the auditor only reads; the test-runner may only run `npm run test:run`; the test-writer writes only under `tests/` and the fixer only under `src/`, and both may only run tests. Everything else is blocked, and the agent must report the block to the orchestrator. Runs A and B ran without guardrails (commits `811b2d5` and `bd0e787`). Bypass battery: `node --test tests/hooks/*.test.mjs`.

| | Run A | Run B |
|---|---|---|
| Subagent models | inherit (Opus 5.5) | Sonnet 5.5, test-runner on Haiku 5.5 |
| Agent files commit | `811b2d5` | `bd0e787` |
| Output branch / commit | `week2-run-a` / `736f36f` | `week2-run-b` / `2f32ac2` |
| **Total cost (/usage)** | **$2.17** | **$0.93** (−57%) |
| Duration API / wall | 7m 36s / 7m 35s | 2m 53s / 3m 17s |
| Code changes | +148 / −4 | +97 / −6 |
| Main prompt cache | 9 requests, 93% from cache, no misses | 11 requests, 94% from cache, no misses |
| Findings confirmed and fixed | 15 / 15 | 12 / 12 |
| Full suite after | 29 passed | 26 passed |

## /usage, as shown

Screenshots: [run A](usage-run-a.png), [run B](usage-run-b.png).

```
Run A
claude-haiku-5-5:  13.7k input, 911 output, 0 cache read, 0 cache write ($0.0018)
claude-opus-5-5:   2.5k input, 46.2k output, 1.7m cache read, 156.4k cache write ($2.17)

Run B
claude-haiku-5-5:  3.6k input, 1.1k output, 4.9k cache read, 7.1k cache write ($0.0019)
claude-opus-5-5:   1.0k input, 8.4k output, 711.1k cache read, 35.6k cache write ($0.60)
claude-sonnet-5-5: 32 input, 14.4k output, 170.5k cache read, 65.7k cache write ($0.3256)
```

In run A, the Haiku line is Claude Code's own background calls, not one of our agents.

## Cost per agent, from the session logs

`python3 docs/week2/cost_by_agent.py ~/.claude/projects/<project>/<session>.jsonl` prices each request with the week 2 list prices. Totals land within 5% of /usage.

| Agent | A: model | A: requests | A: cost | B: model | B: requests | B: cost |
|---|---|---|---|---|---|---|
| orchestrator (main) | Opus | 9 | $0.61 | Opus | 11 | $0.56 |
| auditor | Opus | 12 | $0.50 | Sonnet | 4 | $0.11 |
| test-writer | Opus | 11 | $0.36 | Sonnet | 5 | $0.08 |
| fixer | Opus | 14 | $0.55 | Sonnet | 6 | $0.14 |
| test-runner | Opus | 2 | $0.05 | Haiku | 2 | $0.00 |
| **subagents** | | | **$1.46** | | | **$0.33** (−77%) |
| **total** | | | **$2.08** | | | **$0.89** |

The orchestrator barely moved, as expected: the lever only touched subagents. The saving comes from two places: a lower price per token, and fewer requests, because the Sonnet agents explored less.

## Did quality hold?

Not entirely.

- **Coverage:** the run B auditor found 12 issues and the run A auditor found 15. B merged two of A's findings into one test and never raised "username is an object" or "non-numeric shelf id".
- **Cross-check:** run A's 15 tests, run against run B's code, give **14 passed, 1 failed**: `#14 POST /api/shelves/abc/books` doesn't return 400. One real bug survived run B.
- **Test strictness:** three of run B's tests accept two status codes (`201 or 400`, `404 or 400`), where run A pins one.

Run B is 57% cheaper and twice as fast, but it misses one real bug and writes looser tests. Week 3's eval set should measure exactly this trade.
