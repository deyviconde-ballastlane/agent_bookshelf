# Planted-bug eval: 1-sonnet-with-spec

Branch `eval/planted-bugs` against its fork point. Spec in the repository: yes. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 8 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-2.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-3.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| **Mean** | | | | **100%** | **100%** |

Capstone points at this level: recall 6.0 / 6, precision 4.0 / 4

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.49 | 78% | 68s | sonnet-5-5 $0.49 |
| run-2.json | $0.41 | 86% | 77s | sonnet-5-5 $0.41 |
| run-3.json | $0.41 | 86% | 72s | sonnet-5-5 $0.41 |
| **Mean** | **$0.44** | | **72s** | |
