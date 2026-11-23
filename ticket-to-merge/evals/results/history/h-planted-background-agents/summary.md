# Planted-bug eval: 11-final-planted-no-spec

Branch `eval/planted-bugs` against its fork point. Spec in the repository: no, bare ticket criteria. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 8 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-2.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| run-3.json | 8 | P1 P2 P3 P4 P5 P6 P7 P8 | - | 100% | 100% |
| **Mean** | | | | **100%** | **100%** |

Capstone points at this level: recall 6.0 / 6, precision 4.0 / 4

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.34 | 78% | 100s | sonnet-5-5 $0.32, haiku-5-5 $0.02 |
| run-2.json | $0.29 | 82% | 100s | sonnet-5-5 $0.27, haiku-5-5 $0.02 |
| run-3.json | $0.27 | 84% | 87s | sonnet-5-5 $0.26, haiku-5-5 $0.01 |
| **Mean** | **$0.30** | | **96s** | |
