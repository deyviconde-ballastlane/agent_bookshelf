---
name: ship-ticket
description: Take one ticket from its spec to merge-ready, with failing tests first, an implementation gated on a green suite, a read-only review and a fix loop. Use only when the user asks to ship or build a ticket that has a spec file.
argument-hint: "[spec path, default SPEC.md] [build | review | fix] [include-low]"
disable-model-invocation: true
model: sonnet
---

# Ship a ticket

You coordinate. The agents write the tests and the code; you brief them, check their evidence and commit. You never edit `src/` or `tests/` yourself.

Arguments from the user (may be empty): `$ARGUMENTS`

- The first argument that is a file path is the spec. Default: `SPEC.md`.
- `build`, `review` or `fix` runs only that stage, and nothing else. With no stage word, run the three stages in order.
- `include-low` makes the fix stage handle `low` findings too.

## Before any stage

1. Read the spec. If there is no spec file, stop and say so: a ticket without a spec is not ready to build.
2. Run `git status --short` and `git rev-parse --abbrev-ref HEAD`. Stop if the branch is `main` or `master`.
3. Run `npm run test:run` and note how many tests pass. Stop if the suite is already red.

## Stage 1: build

The two agents run one after the other, never in parallel: the implementer needs the tests the writer produces.

1. **Red.** Brief `ticket-to-merge:test-writer`:

   ```
   Build mode. Spec: <spec path>. Write failing tests for every rule on every surface the spec names.
   Constraints: <the spec's constraints, pasted>.
   Return the files you wrote and the result table. Under 150 words.
   ```

2. **Confirm red yourself.** Run `npm run test:run`. The tests that existed before must still pass, and the new ones must fail on assertions. A new test that already passes is fine only when the spec says the behaviour already exists.
3. **Commit the tests**: `git add tests && git commit -m "test: failing tests for <ticket id>"`. A committed test cannot be quietly changed later.
4. **Green.** Brief `ticket-to-merge:implementer`:

   ```
   Spec: <spec path>. Failing tests: <test files>. Make them pass without editing them.
   Constraints: <the spec's constraints, pasted>.
   Return the files you changed and the pasted test summary. Under 150 words.
   ```

   A SubagentStop hook runs the suite when the implementer tries to finish and sends it back while the suite is red.
5. **Confirm green yourself.** Run `npm run test:run` and the spec's own verify commands. Trust the output, not the agent's summary.
   - If the implementer returned `BLOCKED:`, send that test and that rule to the test-writer to correct, then brief the implementer again. Two rounds at most, then stop and report.
6. **Commit**: `git add -A && git commit -m "feat: <ticket id> <title>"`.

## Stage 2: review

Read `${CLAUDE_PLUGIN_ROOT}/skills/review-pr/SKILL.md` and follow its five steps exactly. It is the same procedure `/ticket-to-merge:review-pr` runs. It ends with a JSON array of findings, saved in `.ticket-to-merge/findings.json` and printed.

That file names the plugin folder with a variable. Read as a plain file, the variable is not filled in, so use these exact commands for its steps 1 and 5, each as one Bash call with nothing added:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/collect-diff.mjs" main
node "${CLAUDE_PLUGIN_ROOT}/scripts/anchor-lines.mjs"
```

After step 5, write the printed array back to `.ticket-to-merge/findings.json`, so the fix stage reads the corrected line numbers.

## Stage 3: fix

Read `.ticket-to-merge/findings.json`. It holds the findings of the last review, so do not review again before fixing. If it is `[]`, there is nothing to fix.

Fix the `high` and `medium` findings. `low` findings are left for a human to decide, unless the user wrote `include-low`.

All the findings go in one pass:

1. **Prove.** Brief `ticket-to-merge:test-writer` in fix mode with the findings, verbatim. It writes one failing test per finding.
   - A finding about the code whose test passes is not reproduced. Drop it and say so in the final report.
   - A finding about a missing or weak test is fixed by the test itself. That test should pass, and no implementer is needed for it.
2. **Commit the tests**: `test: prove review findings`.
3. If any test fails, brief `ticket-to-merge:implementer` with the failing tests and the findings they prove.
4. **Confirm green yourself**, then commit: `fix: <what was wrong>`.
5. **Review again**: run stage 2 once more. If findings remain after two fix rounds, stop and report them. Do not loop further.

## Final report

Evidence, not claims:

| Stage | Evidence |
|---|---|
| Build | test files, tests before and after, the pasted last lines of `npm run test:run` |
| Review | number of findings by severity, and the array |
| Fix | each finding: proved by which test, fixed in which commit, or dropped and why |

Then the commits you made (`git log --oneline main..HEAD`) and what is left for a human: open findings, pushing the branch and opening the pull request. Do not push and do not open the pull request yourself.
