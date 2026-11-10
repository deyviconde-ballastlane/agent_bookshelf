---
name: audit-fix
description: Audit a code scope against one rule, confirm each finding with a failing test, fix the confirmed ones, and run the full suite. Orchestrates the auditor, test-writer, fixer and test-runner subagents.
disable-model-invocation: true
argument-hint: "<rule or concern>" <scope path>
---

# Audit, confirm, fix

Request: $ARGUMENTS

You are the orchestrator. You write the briefs, pass results between agents and decide. You never read the scope's code yourself and never edit files: the agents do that. Running this skill is the task's explicit request to fix this gap (CLAUDE.md rule 8).

Subagents start fresh: they don't see this conversation. Put everything they need in the brief, in this shape:

```
Task: ...
Context: ...
Constraints: ...
Return: (the format from the agent's own file)
```

Pass results between agents verbatim. Don't summarize or re-check them.

Each agent is fenced by `.claude/hooks/agent-guard.mjs` (what it may write and run). If an agent reports a block, a crash or a command it couldn't run: stop the pipeline, show the report to the user as is, and don't redo that agent's work yourself.

## Steps (pipeline: each step starts when the previous one returns)

1. **auditor.** Task: audit `<scope>` against `<rule>`. Context: the rule's text from CLAUDE.md if it refers to one. If it returns `0 findings`, stop and report that.

2. **test-writer.** Task: one test per finding, in `tests/audit/<short-slug>.test.ts`. Context: the auditor's table. Constraints: don't touch `src/`. Findings whose test passes are not bugs and are dropped.

3. **fixer.** Only if at least one finding is `FAIL (confirmed)`. Task: fix the confirmed findings. Context: the confirmed rows and the test file path. Constraints: smallest change, no edits under `tests/`.

4. **test-runner.** Full suite. If anything fails, send the failures back to the fixer **once**, then run test-runner again. Never loop more than once.

## Final report (under 200 words)

| # | finding | confirmed? | fixed? |
|---|---|---|---|

Then: the final suite summary line and the files touched. Don't commit.
