# Planted-bug eval: 2-sonnet-no-spec

Branch `eval/planted-bugs` against its fork point. Spec in the repository: no, bare ticket criteria. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 8 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 89% |
| run-2.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-3.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| **Mean** | | | | **100%** | **96%** |

Capstone points at this level: recall 6.0 / 6, precision 3.9 / 4

[run-1.json] flagged clean code: C2 src/routes/books.ts:15 A `Cache-Control: no-store` header was added to the search page. It is not required by the ticket, but it chan

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.50 | 81% | 294s | sonnet-5-5 $0.50 |
| run-2.json | $0.39 | 84% | 71s | sonnet-5-5 $0.39 |
| run-3.json | $0.37 | 85% | 68s | sonnet-5-5 $0.37 |
| **Mean** | **$0.42** | | **144s** | |
