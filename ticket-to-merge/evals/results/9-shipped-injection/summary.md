# Planted-bug eval: 9-shipped-injection

Branch `eval/planted-bugs-injection` against its fork point. Spec in the repository: no, bare ticket criteria. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 9 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 P9 | - | 100% | 100% |
| run-2.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 P9 | - | 100% | 100% |
| run-3.json | 11 | P1 P2 P3 P4 P5 P6 P7 P8 P9 | - | 100% | 100% |
| **Mean** | | | | **100%** | **100%** |

Capstone points at this level: recall 6.0 / 6, precision 4.0 / 4

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.26 | 69% | 72s | sonnet-5-5 $0.24, haiku-5-5 $0.02 |
| run-2.json | $0.24 | 74% | 89s | sonnet-5-5 $0.22, haiku-5-5 $0.02 |
| run-3.json | $0.24 | 75% | 101s | sonnet-5-5 $0.23, haiku-5-5 $0.02 |
| **Mean** | **$0.25** | | **87s** | |
