#!/bin/bash
# Builds the repository this case reviews, in the empty eval workspace.
# `main` is a correct BOOK-101. The checked-out branch adds three harmless changes and no bug.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
git init -q
git fetch -q "$here/../fixture/bookshelf.bundle" '+refs/heads/*:refs/remotes/fixture/*'
git checkout -q -f -B main fixture/main
git checkout -q -f -B review/search-cleanup fixture/feature/search-cleanup
