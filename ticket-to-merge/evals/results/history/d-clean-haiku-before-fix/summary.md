# Clean-branch eval: history/d-clean-haiku-before-fix

Three harmless changes, no bug. Model overrides: none.

| Run | Findings | Cost | Wall time |
|---|---|---|---|
| run-1.json | 2 | $0.21 | 46s |
| run-2.json | 2 | $0.13 | 36s |
| run-3.json | 0 | $0.06 | 34s |

Clean runs: 1 of 3.

False alarms:

- [run-1.json] src/models/book.ts:50 (medium) Case-insensitive matching uses SQLite LIKE, which only folds ASCII case, so non-ASCII titles and authors do not match across case. No test covers this.
- [run-1.json] src/models/book.ts:42 (low) The 100-character limit is checked against UTF-16 code units, so a query under 100 characters is rejected when it contains astral-plane characters such as emoji.
- [run-2.json] src/models/book.ts:50 (medium) SQLite LIKE only folds ASCII case by default, so the search is not case-insensitive for non-ASCII letters.
- [run-2.json] src/models/book.ts:42 (low) The length limit uses String.length, which counts UTF-16 code units, so valid queries of 100 characters or fewer that contain astral characters are rejected.
