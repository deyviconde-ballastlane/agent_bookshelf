# Planted-bug eval: baseline-sonnet

Branch `eval/planted-bugs` against `capstone`. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 8 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-2.json | 10 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 90% |
| run-3.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 89% |
| **Mean** | | | | **100%** | **93%** |

Capstone points at this level: recall 6.0 / 6, precision 3.7 / 4

[run-2.json] flagged clean code: C2 src/routes/books.ts:15 A `Cache-Control: no-store` header was added to the HTML search response, which the ticket does not ask for.

[run-3.json] flagged clean code: C2 src/routes/books.ts:15 A Cache-Control header was added to the HTML search response. The ticket did not ask for it (rule 10).

| Run | Cost | Cache hit | Time | Models |
|---|---|---|---|---|
| run-1.json | $0.47 | 79% | 7s | claude-sonnet-5-5 |
| run-2.json | $0.42 | 84% | 8s | claude-sonnet-5-5 |
| run-3.json | $0.31 | 88% | 6s | claude-sonnet-5-5 |
