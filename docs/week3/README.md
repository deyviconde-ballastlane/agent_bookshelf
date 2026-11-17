# Week 3: an eval set, and week 2 re-run on it

**Week 2's open question:** moving the auditor from Opus to Sonnet cut the cost 57%, but one real bug got through. Was that the model, or luck?

**The eval:** 32 HTTP requests against the JSON API (`evals/cases.json`). 15 break CLAUDE.md rule 5 and 17 are fine, so the auditor is tested where it should flag and where it should stay quiet. 15 of the cases are the bugs week 2's run A proved with failing tests.

| Term | Here |
|---|---|
| Task | one request, e.g. `POST /api/shelves/abc/books {"bookId":1}` |
| Outcome | the status the real API returns (the harness fires the request with supertest on a fresh DB) |
| Grader | code: the model says `VIOLATES` or `OK`, and it must match the outcome |
| Harness | `evals/run.ts`: builds the ground truth, asks each model once with read-only tools, grades, prints pass rate and cost |

```
npx tsx evals/run.ts                                      # ground truth only, free
npx tsx evals/run.ts claude-opus-5-5 claude-sonnet-5-5    # the week 2 change, same suite
```

## Result

| | Opus 5.5 (before) | Sonnet 5.5 (after) |
|---|---|---|
| Pass rate | 32/32 (100%) | 32/32 (100%) |
| Bugs caught | 15/15 | 15/15 |
| No false alarm | 17/17 | 17/17 |
| Cost per run | $0.82 | $0.30 (−63%) |
| Time | 67s | 21s |

One trial per model. Per-case verdicts and session ids are in `evals/results/`.

## What it says

- When the case is put in front of it, Sonnet judges it as well as Opus, including the three hard ones where the API answers 201 for a user or book that doesn't exist.
- So week 2's miss was not judgement. The Sonnet auditor never *raised* `POST /api/shelves/abc/books`; it made 4 requests where Opus made 12. This eval hands the cases over, so it can't see that.
- Both models at 100% means the suite has no hill left to climb: it is a regression suite now. The next cases have to be open-ended ("audit this file", graded on how many of the 15 known bugs come back).

**Decision:** keep Sonnet for the auditor. The fix for the missed bug is a better brief (a checklist of input classes to try per route), not a more expensive model.
