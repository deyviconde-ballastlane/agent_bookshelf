# Planted-bug eval: 1-sonnet-with-spec

Branch `eval/planted-bugs` against its fork point. Spec in the repository: yes. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 8 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-2.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-3.json | 8 | P1 P2 P4 P5 P6 P7 P8 | P3 | 88% | 88% |
| **Mean** | | | | **96%** | **96%** |

Capstone points at this level: recall 5.8 / 6, precision 3.8 / 4

[run-3.json] flagged clean code: C2 src/routes/books.ts:16 A `Cache-Control: no-store` header was added to the HTML search route. The ticket does not ask for it.

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.43 | 79% | 51s | sonnet-5-5 $0.43 |
| run-2.json | $0.35 | 87% | 60s | sonnet-5-5 $0.35 |
| run-3.json | $0.35 | 84% | 63s | sonnet-5-5 $0.35 |
| **Mean** | **$0.38** | | **58s** | |
