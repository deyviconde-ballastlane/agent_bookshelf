# Planted-bug eval: 11-grader-rehearsal-planted

Branch `eval/planted-bugs` against its fork point. Spec in the repository: no, bare ticket criteria. Base: upstream main, so the diff is the whole feature plus the plants. Model overrides: none. Test output given to the reviewers: no.

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
| run-1.json | $0.32 | 63% | 92s | sonnet-5-5 $0.30, haiku-5-5 $0.02 |
| run-2.json | $0.22 | 74% | 83s | sonnet-5-5 $0.20, haiku-5-5 $0.02 |
| run-3.json | $0.22 | 69% | 76s | sonnet-5-5 $0.21, haiku-5-5 $0.02 |
| **Mean** | **$0.25** | | **84s** | |
