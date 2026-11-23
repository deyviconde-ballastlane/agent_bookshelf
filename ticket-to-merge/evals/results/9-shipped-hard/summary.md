# Planted-bug eval: 9-shipped-hard

Branch `eval/planted-bugs-hard` against its fork point. Spec in the repository: yes. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 8 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 8 | H1 H2 H3 H4 H5 H6 H7 H8 | - | 100% | 100% |
| run-2.json | 8 | H1 H2 H3 H4 H5 H6 H7 H8 | - | 100% | 100% |
| run-3.json | 8 | H1 H2 H3 H4 H5 H6 H7 H8 | - | 100% | 100% |
| **Mean** | | | | **100%** | **100%** |

Capstone points at this level: recall 6.0 / 6, precision 4.0 / 4

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.27 | 71% | 70s | sonnet-5-5 $0.26, haiku-5-5 $0.01 |
| run-2.json | $0.19 | 77% | 65s | sonnet-5-5 $0.18, haiku-5-5 $0.01 |
| run-3.json | $0.20 | 81% | 80s | sonnet-5-5 $0.19, haiku-5-5 $0.01 |
| **Mean** | **$0.22** | | **72s** | |
