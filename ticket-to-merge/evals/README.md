# Evals for the reviewer

Three questions, three suites:

| Question | Suite | Runner |
|---|---|---|
| Does it find real bugs? | `eval/planted-bugs`: 8 textbook bugs and 3 harmless changes. Answer key: `planted-bugs.json`. | `run.mjs` |
| Does it find subtle ones? | `eval/planted-bugs-hard`: 8 bugs that break a rule on one surface or in one edge case. Answer key: `planted-bugs-hard.json`. | `run.mjs --manifest planted-bugs-hard.json` |
| Does it stay quiet when nothing is wrong? | A branch with only the 3 harmless changes, from `fixture/bookshelf.bundle`. | `run-clean.mjs` |

`score.mjs` matches findings to the answer key. `review-planted/` and `review-clean/` are the same two questions as `claude plugin eval` cases, which run each prompt with and without the plugin.

Every review runs in a throwaway repository that holds neither the plugin nor an answer key, and the reviewers get no test output.

## Results

Each folder holds the raw `claude -p` output of every run and a `summary.md`.

| Folder | What it measured |
|---|---|
| `1-sonnet-with-spec`, `2-sonnet-no-spec` | Planted bugs, Sonnet reviewers |
| `3-haiku-specialists-with-spec`, `4-haiku-specialists-no-spec` | Planted bugs, Haiku reviewers (the cost lever) |
| `5-hard-sonnet`, `6-hard-haiku-specialists` | The hard set, both models |
| `7-clean-haiku`, `7b-clean-haiku-six-more`, `8-clean-sonnet` | The clean branch, both models, after the scope check |
| `9-final-check-haiku-no-spec` | Planted bugs once more, with the plugin exactly as shipped |
| `10-plugin-eval` | `claude plugin eval`: with the plugin and without it |
| `history/` | Runs from before each fix: the first prompts, the wrong line numbers, the clean-branch false alarms, the first plugin eval |

Folders 1 to 6 were measured before the scope check existed. The check is a script, so it was replayed over those 18 saved runs: it drops 0 of their 149 findings.

## Rebuilding the fixture

```
bash ticket-to-merge/evals/fixture/build.sh
```

It rebuilds `bookshelf.bundle` from the `capstone` and `eval/planted-bugs` branches.
