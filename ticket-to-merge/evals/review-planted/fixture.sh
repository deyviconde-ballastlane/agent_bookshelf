#!/bin/bash
# Builds the repository this case reviews, in the empty eval workspace.
# `main` is a correct BOOK-101. The checked-out branch adds eight planted bugs and three harmless changes.
# The answer key is ../planted-bugs.json.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
git init -q
git fetch -q "$here/../fixture/bookshelf.bundle" '+refs/heads/*:refs/remotes/fixture/*'
git checkout -q -f -B main fixture/main
git checkout -q -f -B review/search-tidy fixture/feature/search-tidy
