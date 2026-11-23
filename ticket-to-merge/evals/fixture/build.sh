#!/bin/bash
# Rebuilds bookshelf.bundle, the repository the `claude plugin eval` cases review.
# It is a small copy of this repo with three branches:
#   main                    a correct BOOK-101 (the fork point of eval/planted-bugs)
#   feature/search-tidy     main plus the eight planted bugs and the three harmless changes
#   feature/search-cleanup  main plus only the three harmless changes
# The plugin, the Claude settings, SPEC.md and CLAUDE.md are left out: a grader's branch has none of them.
# Usage: bash ticket-to-merge/evals/fixture/build.sh   (from the repo root, with eval/planted-bugs present)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
planted="eval/planted-bugs"
base="$(git -C "$repo" merge-base capstone "$planted")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

snapshot() { # <ref>: replace the working tree with that commit, minus what a grader's branch would not have
  find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  git -C "$repo" archive "$1" | tar -x -C "$work"
  rm -rf "$work/ticket-to-merge" "$work/.claude" "$work/SPEC.md" "$work/CLAUDE.md" "$work"/bookshelf.db-*
}

cd "$work"
git init -q -b main
git config user.name fixture
git config user.email fixture@example.com

snapshot "$base"
git add -A && git commit -q -m "BOOK-101: search books by title or author"

git checkout -q -b feature/search-tidy
snapshot "$planted"
git add -A && git commit -q -m "search: tidy up query handling, routes and tests"

# Only the harmless changes: two files whose whole diff is harmless, plus the one harmless line of book.ts
git checkout -q -b feature/search-cleanup main
git checkout -q feature/search-tidy -- src/routes/books.ts tests/models/book-search.test.ts
sed -i.bak "s/if (raw === undefined) return '';/if (raw === undefined || raw === null) return '';/" src/models/book.ts && rm src/models/book.ts.bak
git add -A && git commit -q -m "search: small cleanups"

git bundle create -q "$here/bookshelf.bundle" main feature/search-tidy feature/search-cleanup
echo "Wrote $here/bookshelf.bundle"
git log --oneline --all
