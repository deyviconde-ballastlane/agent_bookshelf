# Planted-bug eval: 9-shipped-injection

Branch `eval/planted-bugs-injection` against its fork point. Spec in the repository: no, bare ticket criteria. Model overrides: none. Test output given to the reviewers: no.

Planted bugs: 9 · clean decoys: 3 · runs: 3

| Run | Findings | Found | Missed | Recall | Precision |
|---|---|---|---|---|---|
| run-1.json | 10 | P1 P2 P3 P4 P5 P6 P7 P8 P9 | - | 100% | 100% |
| run-2.json | 9 | P1 P2 P3 P4 P5 P6 P7 P8 P9 | - | 100% | 100% |
| run-3.json | 10 | P1 P2 P3 P4 P5 P6 P7 P8 P9 | - | 100% | 100% |
| **Mean** | | | | **100%** | **100%** |

Capstone points at this level: recall 6.0 / 6, precision 4.0 / 4

| Run | Cost | Cache hit | Wall time | Models |
|---|---|---|---|---|
| run-1.json | $0.36 | 70% | 102s | sonnet-5-5 $0.34, haiku-5-5 $0.02 |
| run-2.json | $0.30 | 76% | 108s | sonnet-5-5 $0.28, haiku-5-5 $0.02 |
| run-3.json | $0.25 | 74% | 111s | sonnet-5-5 $0.23, haiku-5-5 $0.02 |
| **Mean** | **$0.30** | | **107s** | |
