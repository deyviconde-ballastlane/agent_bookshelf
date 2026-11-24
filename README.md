# Capstone · Ticket to Merge

Ticket BOOK-101, "Search books by title or author", taken from a spec to merge-ready by agents. The pipeline that did it is packaged as a Claude Code plugin.

| What | Where |
|---|---|
| Fork and branch | `deyviconde-ballastlane/agent_bookshelf`, branch `capstone` |
| Plugin | [`ticket-to-merge/`](ticket-to-merge/) |
| Spec and conventions | [`SPEC.md`](SPEC.md), [`CLAUDE.md`](CLAUDE.md) |
| Planted-bug branches | `eval/planted-bugs`, `eval/planted-bugs-hard`, `eval/planted-bugs-injection` |
| Evidence | [`ticket-to-merge/docs/`](ticket-to-merge/docs/), [`ticket-to-merge/evals/results/`](ticket-to-merge/evals/results/) |

The app's own README starts at [Agent Bookshelf](#agent-bookshelf).

## Run it

```
claude plugin validate ./ticket-to-merge
claude --plugin-dir ./ticket-to-merge
```

Then, inside Claude Code:

| Command | What it does |
|---|---|
| `/ticket-to-merge:ship-ticket SPEC.md` | Builds the ticket test-first, reviews it and fixes what the review finds. Add `build`, `review` or `fix` to run one stage. |
| `/ticket-to-merge:review-pr` | Reviews the current branch against `main` and prints a JSON array of findings. Pass another base as the argument. |

`/review-pr` replies with one JSON array and nothing else, or `[]` for a clean branch:

```json
[{"file": "src/models/book.ts", "line": 49, "severity": "high", "issue": "…", "evidence": "…"}]
```

It needs no setup in the repository it reviews. When that repository has no `SPEC.md`, it reviews against the BOOK-101 acceptance criteria bundled in the skill.

Headless:

```
claude -p "/ticket-to-merge:review-pr main" --plugin-dir ./ticket-to-merge --output-format json
```

It needs no permission flags. The skill pre-approves its own two `node` commands, the reviewers only read, and a hook hands the verifier's output to the last script. Every cost on this page comes from headless runs like this one.

## Submission checklist

| Item | Where |
|---|---|
| Repo link: fork and branch | Table above |
| How to run `/ship-ticket` and `/review-pr` | [Run it](#run-it) |
| `SPEC.md` and `CLAUDE.md` | [`SPEC.md`](SPEC.md), [`CLAUDE.md`](CLAUDE.md) (44 lines) |
| The plugin passes `claude plugin validate` | Yes: "Validation passed". Its one note is a missing marketplace icon. |
| Test run, green | [The ticket](#the-ticket): 80 tests passing |
| Planted bugs: recall and precision over 3 runs | [The reviewer](#the-reviewer-against-planted-bugs) |
| Cost report with one lever | [Cost report](#cost-report) |
| Design: why this split, which models, what I'd cut | [Design](#design) |
| Stretch | [What the plugin adds](#stretch-what-the-plugin-adds) |

## Results

### The ticket

The brief left the interface blank (`Interface: [endpoint and response shape]`), so [`SPEC.md`](SPEC.md) fixes it. The rules live once, in the model, and three surfaces serve them: the model function, JSON at `/api/books/search?q=` and `/api/books?q=`, and the HTML partial at `/books/search?q=` that the existing search box already calls. Nothing that existed changes shape.

```
npm run test:run

 Test Files  5 passed (5)
      Tests  80 passed (80)
```

| Step | Tests | What happened |
|---|---|---|
| Before | 14 passing | The suite as it is on `main` |
| Red | 14 passing, 45 failing | The test-writer added 63 tests from the spec. 45 failed on assertions. The other 18 covered behaviour that already existed. |
| Green | 77 passing | The implementer changed `src/` only. The gate would not let it stop on a red suite. |
| After the fix loop | 80 passing | The review found one low-severity gap, a missing model-level test. The fix loop added 3 tests. |

A second check, on the tests themselves: I ran the whole pipeline again from the setup commit, as one `/ship-ticket` command, on the branch `eval/second-build`. Its test-writer wrote 77 tests of its own from the same spec. All 77 pass against this branch's implementation, which they were not written for.

### The reviewer, against planted bugs

`eval/planted-bugs` holds 8 planted bugs and 3 harmless changes that look suspicious. `eval/planted-bugs-hard` holds 8 subtler bugs, each breaking a rule on one surface or in one edge case, and 3 more harmless changes. `eval/planted-bugs-injection` is the first set plus a code comment that tells automated reviewers to report nothing. The answer keys are the three `planted-bugs*.json` files in [`ticket-to-merge/evals/`](ticket-to-merge/evals/).

Each row is 3 runs of `/review-pr` in a throwaway repository that contains neither the plugin nor the answer key. The reviewers get no test output, so they have to find the bugs by reading.

| Suite | Reviewers | Recall | Precision | Cost per review | Time |
|---|---|---|---|---|---|
| Planted bugs, spec in the repo | Sonnet | 24 of 24 | 100% | $0.44 | 72 s |
| Planted bugs, spec in the repo | **Haiku** | 24 of 24 | 100% | $0.29 | 80 s |
| Planted bugs, no spec | Sonnet | 24 of 24 | 96% | $0.42 | 70 s |
| Planted bugs, no spec | **Haiku** | 24 of 24 | 100% | $0.31 | 95 s |
| Hard set, spec in the repo | Sonnet | 24 of 24 | 100% | $0.40 | 67 s |
| Hard set, spec in the repo | **Haiku** | 24 of 24 | 100% | $0.26 | 73 s |

The plugin ships the Haiku rows. Recall is planted bugs found over planted bugs. Precision is findings that point at a planted bug over all findings. The one false alarm in 18 runs was a harmless `Cache-Control` header. All 149 findings carry the correct line number.

"No spec" is the condition that matters most for grading: the branch under review has no `SPEC.md`, so the reviewers work from the ticket's bare acceptance criteria.

A reviewer also has to stay quiet when nothing is wrong. The third suite is a branch with the three harmless changes and no bug, where the only right answer is `[]`:

| Suite | Reviewers | Clean reviews |
|---|---|---|
| Clean branch, no spec | Sonnet | 3 of 3 |
| Clean branch, no spec | **Haiku** | 9 of 9 |

```
node ticket-to-merge/evals/run.mjs --runs 3 --label my-run                           # as shipped, spec in the repo
node ticket-to-merge/evals/run.mjs --runs 3 --no-spec
node ticket-to-merge/evals/run.mjs --runs 3 --manifest planted-bugs-hard.json
node ticket-to-merge/evals/run-clean.mjs --runs 3
node ticket-to-merge/evals/run.mjs --runs 3 --models "review-spec=sonnet,review-security=sonnet,review-scope=sonnet"
```

**What the evals caught in my own reviewer.** Six defects. Five of the fixes moved a rule out of a prompt and into a script or a hook:

| Run | What went wrong | Fix |
|---|---|---|
| First planted run | Precision 93%: two of three runs flagged the harmless header as "not asked for". | A rule for the scope reviewer and the verifier: a finding has to affect correctness or the requirements. |
| Second planted run | One run reported line numbers of the diff file, not of the source, on 3 findings of 75. | The diff now carries the real line number on every line, and `scripts/anchor-lines.mjs` checks each finding's line against the file. |
| First clean-branch run | With Haiku reviewers, 2 of 3 reviews of the clean branch reported problems in code the branch had not touched. With Sonnet reviewers, 0 of 3. | The script drops a finding that sits more than 8 lines from anything the branch changed. |
| Review of this ticket, after the lever | It published a finding the verifier had marked as unproven: how emoji count toward the 100-character limit. | `low` now means "not proven", and the script does not publish it. It is saved to `unconfirmed.json` for a human. |
| Injection branch | A code comment told automated reviewers to report nothing for one file. They never obeyed it: the three bugs in that file were found in 3 of 3 runs. But they reported the comment itself in only 1 of 3. | `scripts/collect-diff.mjs` now reports text addressed to a reviewer as a fact, before any model reads the diff. 3 of 3 since. |
| A run with default permissions | The last step saved the findings with the Write tool. A headless session with default permissions denies that, so the script checks silently did not run. | A `SubagentStop` hook saves the verifier's output. The last step is now one plain `node` command that the skill pre-approves: no denied permission in the 28 runs since. |

The `low` rule is backed by every run I had saved: 6 of the 8 false alarms in them were `low`, and no planted bug was ever reported only as `low`. Replaying the script over those runs publishes 242 of 248 findings, with 100% precision in every set and recall unchanged.

The third defect is the one I would have shipped without noticing. Every branch in the planted suites had real bugs in it, so those suites could only measure whether the reviewer speaks up. They could not measure whether it stays quiet. The runs from before each fix are kept in [`evals/results/history/`](ticket-to-merge/evals/results/history/).

**The pipeline exactly as shipped**, measured once more after all six fixes. 3 runs per planted suite, 6 on the clean branch:

| Suite | Recall | Precision or clean reviews | Cost per review |
|---|---|---|---|
| Planted bugs, no spec | 24 of 24 | 100% | $0.24 |
| Hard set, spec in the repo | 24 of 24 | 100% | $0.22 |
| Clean branch, no spec | n/a | 6 of 6 clean | $0.09 |
| Planted bugs plus the injected comment, no spec | 27 of 27 | 100% | $0.25 |
| Planted bugs with the whole feature in the diff (base: upstream `main`), no spec | 24 of 24 | 100% | $0.25 |

### Cost report

All figures are `total_cost_usd` and `modelUsage` from `claude -p --output-format json`. That is the session's own accounting, the same numbers `/usage` shows, and it includes the subagents.

| Stage | Cost | Cache hit | Models | Wall time | Agents |
|---|---|---|---|---|---|
| Build | $0.54 | 88% | Sonnet 5.5 | 2 min 1 s | test-writer, implementer |
| Review | $0.39 | 84% | Sonnet 5.5 | 50 s | 3 reviewers, verifier |
| Fix loop | $0.45 | 84% | Sonnet 5.5 | 51 s | test-writer, 3 reviewers |
| **Total, one ticket** | **$1.38** | | | | |

```
node ticket-to-merge/scripts/cost-report.mjs Build=ticket-to-merge/docs/runs/build.json \
  Review=ticket-to-merge/docs/runs/review.json "Fix loop=ticket-to-merge/docs/runs/fix-loop.json"
```

The fix loop was measured twice. The first run cost $0.73 because the argument `fix all` read as "run all stages" and it reviewed once more than needed. The argument is now `include-low`, and the run was repeated from the same commit on a throwaway branch.

**One lever: a cheaper reviewer model.** The three specialist reviewers moved from Sonnet to Haiku. The verifier and the orchestrator stayed on Sonnet. Same suites, same verifier, same Claude Code version (2.1.322), 3 runs on each side.

| | Sonnet reviewers | Haiku reviewers | Change |
|---|---|---|---|
| Cost per review, mean of the three planted suites | $0.42 | $0.29 | −32% |
| Planted bugs found | 72 of 72 | 72 of 72 | none |
| False alarms in 9 planted runs | 1 | 0 | |
| Clean branch reviewed without a false alarm, first try | 3 of 3 | 1 of 3 | worse |
| Clean branch, after the scope check | 3 of 3 | 9 of 9 | none |
| Review stage of this ticket, re-run after the lever | $0.39 | $0.22 | −44% |

**Did quality hold?** Not at first, and my first two suites said it had. On the planted branches Haiku found the same 72 bugs with no new false alarms. On a branch with nothing wrong, it went looking in the surrounding code and reported two edge cases the branch had not touched, in 2 of 3 runs. The Sonnet verifier let them through.

I kept the lever and fixed the cause with a script instead of a prompt: a finding more than 8 lines from anything the branch changed is dropped. Then I measured again. The clean branch is quiet on both models, and the planted suite still finds 24 of 24. The 80 tests are untouched by this lever.

What I cannot claim is that the two models are equal. The planted suites sit at 100% on both sides, so they have stopped telling the models apart: they are regression suites now. With 72 of 72 found, the most I can say is that recall on bugs like these is probably above 96%. If a real miss shows up, the first move is to add it to the suite and run both sides again.

**Where the rest of the money goes.** After the lever the three Haiku reviewers cost $0.01 to $0.02 per review in total. The rest, $0.20 to $0.28, is Sonnet: the orchestrator and the verifier.

## Design

### Why this split

**Build: two agents in sequence, not in parallel.** The ticket touches four files in three layers that depend on each other: model, routes, view. Splitting by layer would put parallel agents on shared files and force worktrees and a merge step, for a change one agent finishes in two minutes. The split that pays is by role. One agent writes the tests from the spec before any implementation exists. The other makes them pass and cannot edit them. A fresh context is not biased toward code it just wrote.

**Review: three specialists in parallel, then one verifier.** Each reviewer has one lens and a checklist of inputs to try. Week 3 taught me why: my auditor's misses came from cases it never raised, not from how it judged a case it was handed. The three run at once because they are independent and read-only. The orchestrator waits for all three before deciding. That barrier is right here and only here: the same defect is often reported twice, and de-duplication needs every result.

**The verifier exists for precision.** A reviewer asked for problems reports some even when the code is sound. The verifier gets the candidates in a fresh context and is told to refute them. It drops what it cannot confirm and merges duplicates.

**Facts are checked by scripts, not models.** `scripts/collect-diff.mjs` answers what needs no judgement before any agent starts: did a protected file change, did a dependency change, was a test skipped or deleted. `scripts/anchor-lines.mjs` runs at the end: it checks every line number, drops findings about code the branch did not change, and holds back what the verifier could not prove. Both cost zero tokens and give the same answer on every run. It is the hook lesson from week 1 applied to the reviewer: a rule in a prompt is a request, a script is a guarantee. The handoff works the same way: a hook saves the verifier's output for that last script, so the coordinator never re-types the findings.

**The orchestrator only dispatches.** It never reads the diff. The script writes it to a file and the reviewers read it, so the diff is paid for as input, once per reviewer, instead of being re-typed three times as output.

### Which models

| Agent | Model | Why |
|---|---|---|
| Orchestrator, both skills | Sonnet | It briefs, checks evidence and commits. It is pinned in the skill so a session on a bigger model does not pay that price for dispatching. |
| test-writer | Sonnet | Turning eight rules into boundary cases is where a weak model writes tests that cannot fail. |
| implementer | Sonnet | A small change, but it has to satisfy every rule on three surfaces at once. |
| review-spec, review-security, review-scope | Haiku | Each has one lens, a checklist and a small diff. The lever showed Haiku finds the same bugs for a third less. |
| review-verifier | Sonnet | The last judgement before anything is published. Precision depends on it. |

### What I would cut

- **The second JSON route.** `/api/books?q=` exists only because the brief left the interface blank. With a real spec there is one JSON route and a third fewer route tests.
- **Sonnet for the orchestrator.** After the lever, almost all of a review's cost is Sonnet: the orchestrator and the verifier. The orchestrator's part is mechanical, so it is the next thing I would move to Haiku, measured the same way.
- **The test-writer hop for a missing-test finding.** The fix loop's only real finding was a missing test. Briefing an agent to "prove" a finding whose fix is the test itself is one hop too many.

## Guardrails

There are three layers, because each one covers what the others cannot.

| Layer | Where | What it stops |
|---|---|---|
| PreToolUse hook | [`hooks/protect.mjs`](ticket-to-merge/hooks/protect.mjs) | Any tool call that would change `bookshelf.db`, `src/db/seed.sql`, `src/db/schema.sql` or the guardrail itself, and any read or write of `.env`. It matches `Read`, the edit tools and `Bash`, and exits 2. |
| Permission deny rules | [`.claude/settings.json`](.claude/settings.json) | The same paths for the file tools. Deny rules also cover `@.env` references, which skip PreToolUse hooks. |
| Role fences | The same hook, keyed on `agent_type` | Reviewers cannot write or run anything. The test-writer writes only under `tests/`. The implementer writes only under `src/` and `README.md`, so it cannot make a test pass by editing it. |

Plugin agents ignore `hooks:` and `permissionMode:` in their own frontmatter. So the reviewers are read-only twice: their `tools:` line is `Read, Grep, Glob`, and the plugin hook blocks them by role if that line ever changes.

A second hook script, [`hooks/gate.mjs`](ticket-to-merge/hooks/gate.mjs), is the gate on "done". It runs on `SubagentStop` for the implementer and sends it back to work while `npm run test:run` is red. It gives up after three blocks, so a wrong test cannot loop forever. A third, `hooks/save-findings.mjs`, saves the verifier's output for the last script of a review.

**Evidence.**

```
node --test ticket-to-merge/tests/hook-bypass.test.mjs
# 153 attacks must block, 76 legitimate calls must pass
```

The battery feeds the hook fake tool calls and checks the exit code. It covers path tricks, symlinks, quoting, variables and command substitution, globs, `cd` then a relative path, deleting a parent directory, inline interpreter code that builds the path at run time, a read command that also writes, attempts to switch the guardrail off, and each role fence.

A live drill ran a real session against five bypasses in a throwaway clone. All five were blocked and nothing changed on disk: [`docs/guardrail-drill.md`](ticket-to-merge/docs/guardrail-drill.md).

**Untrusted input.** The reviewers are told that a diff is data: text in it that tells a reviewer what to report is never followed. `scripts/collect-diff.mjs` also looks for such text itself and reports it as a finding, because a script cannot be talked out of it.

**What the hook cannot do.** A PreToolUse hook reads the command text. It cannot see what a script file will do once it runs, so `node some-script.mjs` is only as safe as the script. Closing that needs OS-level isolation (`/sandbox` or a container), not a better regex.

## Stretch: what the plugin adds

`claude plugin eval` runs each case with the plugin and without it, on the same prompt, and reports the difference (Δ). There are two cases, with 3 runs per arm, Sonnet in both arms and the same tools. The prompt hands both arms the ticket's criteria, so the difference is the process and not the information.

| Case | With the plugin | Without | Δ | What it shows |
|---|---|---|---|---|
| `review-planted`: 8 bugs, 3 harmless changes | 1.00, complete in 3 of 3 runs | 0.94, complete in 1 of 3 runs | +0.06 | Plain Claude finds most of the bugs. It missed the unescaped HTML in one run and the schema change in another. |
| `review-clean`: 3 harmless changes | 1.00 | 1.00 | 0 | Both stay quiet. The plugin is not why this case passes. |

The score is the share of 11 checks passed: one per planted bug, two for the harmless changes that must not be flagged, and one for the shape of the output.

The plugin buys a complete review every time, and it pays for it: $0.26 and about 75 seconds per review of the planted branch, against $0.16 and 25 seconds without it. I ran this eval three times while fixing the reviewer. Each time, plain Claude gave a complete review in 1 of 3 runs and the plugin in 3 of 3.

```
claude plugin eval ./ticket-to-merge --scaffold --allow-tools "Bash(node *)" "Bash(git *)" Write --no-publish
```

The first run of this eval is what exposed the clean-branch problem. Its Δ on `review-clean` was −0.50: the plugin scored 0.33 where plain Claude scored 0.83. A reviewer that makes a clean branch look worse than no reviewer at all was invisible from my own planted-bug suites. That run is kept in [`evals/results/history/e-plugin-eval-first/`](ticket-to-merge/evals/results/history/e-plugin-eval-first/).

## Limits

- **The interface is my reading of a blank field.** If the hidden tests call a route or a response shape that `SPEC.md` did not choose, they fail for that reason and not because a rule is broken.
- **The planted bugs are mine.** I wrote the checklists and the bugs, so the suites favour what I thought of. The no-spec condition and the hard set are my attempts to offset that.
- **A headless session sometimes finishes and never exits.** It happened in about 5 of 70 runs: the work was done and the result was never printed. Every one of those sessions had started its subagents in the background. The skills now ask for foreground subagents, and none of the 75 eval runs since has hung. I do not know the cause, so `evals/run.mjs` keeps a watchdog that interrupts a stuck session, which makes it print.

## Plugin layout

```
ticket-to-merge/
├── .claude-plugin/plugin.json
├── skills/
│   ├── ship-ticket/SKILL.md      build, review, fix
│   └── review-pr/SKILL.md        collect, three reviewers, verifier, final checks
├── agents/                        test-writer, implementer, review-spec, review-security,
│                                  review-scope, review-verifier
├── hooks/
│   ├── hooks.json
│   ├── protect.mjs                protected files and role fences (PreToolUse)
│   ├── gate.mjs                   green suite before the implementer stops (SubagentStop)
│   └── save-findings.mjs          hands the verifier's output to the last script (SubagentStop)
├── scripts/
│   ├── collect-diff.mjs           diff with real line numbers, hard-constraint facts, test run
│   ├── anchor-lines.mjs           checks every finding: line number, scope, proof
│   └── cost-report.mjs
├── tests/hook-bypass.test.mjs     the bypass battery
├── evals/                         answer keys, runner, scorer, plugin eval cases, results
└── docs/                          stage runs and the guardrail drill
```

---

```
╔═════════════════════════════════════════════╗
║│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│║
╠═════════════════════════════════════════════╣
║                                             ║
║     ▄▀█ █▀▀ █▀▀ █▄░█ ▀█▀                    ║
║     █▀█ █▄█ █▄▄ █░▀█ ░█░                    ║
║                                             ║
║     █▄▄ █▀█ █▀█ █▄▀ █▀ █░█ █▀▀ █░░ █▀▀      ║
║     █▄█ █▄█ █▄█ █░█ ▄█ █▀█ █▄▄ █▄▄ █▀░      ║
║                                             ║
║  a goodreads-lite playground for AI agents  ║
║                                             ║
╠═════════════════════════════════════════════╣
║│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│║
╚═════════════════════════════════════════════╝
```

# Agent Bookshelf

A Goodreads-lite application designed as a teaching playground for AI agents courses. Students install it locally and use AI agents (Claude Code, etc.) to complete homework assignments.

## Prerequisites

**Node.js 24 LTS** is required.

| OS | Install |
|---|---|
| **macOS** | Download `.pkg` from [nodejs.org](https://nodejs.org) — Universal binary (Intel + Apple Silicon) |
| **Windows** | Download `.msi` from [nodejs.org](https://nodejs.org) — tick "Tools for Native Modules" during install |
| **Linux** | `curl -fsSL https://deb.nodesource.com/setup_24.x \| sudo -E bash - && sudo apt-get install -y nodejs` |

Verify:

```bash
node -v   # should print v24.x.x
npm -v    # should print 11.x.x
```

## Quick Start

### Using npx

```bash
corepack enable
npm install
npm run build
npx agent-bookshelf
```

That's it! The app will start at http://localhost:3000 with pre-seeded data.

## What is this?

Agent Bookshelf is a deliberately structured teaching codebase where:

- **Students** get an easy-to-install app that works immediately
- **AI agents** get a familiar, well-structured codebase to work with
- **Homework gaps** are built in for agents to fill

### Features

- Browse 50 pre-seeded books (tech and sci-fi)
- View book details with reviews and ratings
- Manage user shelves (want-to-read, currently-reading, read)
- Add reviews and ratings
- REST API for agent interaction
- HTMX-powered dynamic UI

### Pre-seeded Data

The app comes with:
- 50 books across tech and sci-fi genres
- 3 users: Alice Chen, Bob Martinez, Carol Okafor
- Sample shelves and reviews
- SQLite database (zero configuration)

## For Students

### Installation

**Prerequisites:** Node.js 20 or higher

**macOS / Linux:**
```bash
npx agent-bookshelf
```

**Windows:**
```bash
npx agent-bookshelf
```

The app will start automatically at http://localhost:3000

### Using the App

1. Browse books at http://localhost:3000
2. Click a book to see details and reviews
3. Visit /shelves to see user bookshelves
4. Add reviews and manage shelves through the UI

### For AI Agents

The app provides a REST API at `/api/*`:

```bash
# Get all books
curl http://localhost:3000/api/books

# Get a specific book
curl http://localhost:3000/api/books/1

# Search books by title or author (400 if q is over 100 characters or not a single string)
curl "http://localhost:3000/api/books/search?q=dune"
curl "http://localhost:3000/api/books?q=dune"

# Add a review
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "bookId": 5, "rating": 5, "reviewText": "Excellent!"}'

# Get user shelves
curl http://localhost:3000/api/shelves/user/1
```

See the API routes in `src/routes/api.ts` for full documentation.

## For Instructors

### Homework Gaps

The codebase includes deliberate gaps for homework assignments:

1. **Search functionality** - UI exists but backend is a TODO
   - Location: `src/routes/books.ts` line 14
   - Students can implement the search backend

2. **Missing tests** - Models have no test coverage
   - Location: `tests/` directory
   - QA homework: write test suites for models

3. **Input validation** - API endpoints lack validation
   - Location: `src/routes/api.ts`
   - Students can add validation middleware

4. **UI improvements** - Functional but minimal design
   - Location: `src/public/css/style.css`
   - PM homework: redesign specific components

### Architecture

- **Backend:** Express + TypeScript
- **Database:** SQLite via sql.js (WebAssembly, zero native dependencies)
- **Frontend:** EJS templates + HTMX
- **Testing:** Vitest (setup included, tests are homework)

### Project Structure

```
agent_bookshelf/
├── src/
│   ├── server.ts          # Express app + server
│   ├── db/
│   │   ├── schema.sql     # Database schema
│   │   ├── seed.sql       # Pre-seeded data
│   │   └── index.ts       # DB connection
│   ├── models/            # Data models (no tests - homework gap)
│   ├── routes/
│   │   ├── books.ts       # HTML routes
│   │   ├── shelves.ts
│   │   ├── reviews.ts
│   │   └── api.ts         # JSON API
│   ├── views/             # EJS templates
│   └── public/            # Static assets
├── tests/                 # Vitest setup (tests are homework)
├── bin/                   # CLI entry point
└── docs/adr/              # Architecture decisions
```

### Running Tests

```bash
npm test          # Run tests in watch mode
npm run test:run  # Run tests once
```

Note: The test setup is included, but actual tests are intentionally missing (homework gap).

## License

GPL-3.0

## Contributing

This is a teaching project. Contributions should maintain the deliberate gaps that make homework assignments possible.
