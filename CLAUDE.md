# Agent Bookshelf

Goodreads-lite teaching app. Express 4 + TypeScript (strict, ESM) + sql.js (SQLite in WASM) + EJS/HTMX + Vitest/supertest. Node 24.

The current ticket is BOOK-101. Its spec is `SPEC.md`: read it before changing anything.

## Commands

- `npm run test:run` — run Vitest once (use this, not `npm test`, which watches)
- `npm run build` — tsc + copy SQL/views/public into `dist/`
- `npm run dev` — dev server on http://localhost:3000. Humans only: it writes `bookshelf.db`.

## Map

- `src/db/index.ts` — the only DB layer: `initDb`, `all`, `get`, `run`, `saveDb`, `closeDb`
- `src/db/schema.sql`, `src/db/seed.sql` — schema and seed (50 books, 3 users, 9 shelves)
- `src/models/*.ts` — one module per table; plain functions, no classes
- `src/routes/api.ts` — JSON API under `/api`
- `src/routes/{books,shelves,reviews}.ts` — HTML routes rendering EJS
- `src/views/**` — pages include `partials/header` and `partials/footer`; `layout.ejs` is unused
- `tests/**/*.test.ts` — Vitest; each file inits its own DB
- `ticket-to-merge/` — the Claude Code plugin that builds and reviews tickets in this repo

## Rules

1. Run `npm run test:run` before saying a task is done, and paste the pass/fail summary.
2. Tests come first: write the failing test from `SPEC.md`, see it fail for the right reason, then implement. Never edit, skip or delete a test to make it pass.
3. Relative TypeScript imports end in `.js` (`import * as Book from '../models/book.js'`).
4. Query the DB only through `all/get/run` from `src/db/index.ts` with `?` placeholders. Never build SQL from request input.
5. Never touch `bookshelf.db`, `src/db/seed.sql`, `src/db/schema.sql` or `.env`. A PreToolUse hook blocks it. If it blocks you, stop and report; do not look for another way in.
6. No new npm dependencies. `package.json` and `package-lock.json` stay as they are.
7. Existing routes, exported functions and response shapes keep their exact shape. New behaviour is additive.
8. JSON API errors use `res.status(code).json({ error: '...' })`: 400 invalid input, 404 not found, 409 conflict. Success: 201 on create, 204 on delete.
9. Routes hit by HTMX (`hx-get`, `hx-post`) return a partial (no header/footer), rendered into the `hx-target`.
10. The repo has other deliberate gaps (validation, tests, CSS). Do not fix anything the ticket does not ask for.
11. Verify with tests, not by starting the server.

## Gotchas

- `initDb()` without a path opens and writes `./bookshelf.db`. Tests always pass their own path under `/tmp`, unique to that test file.
- Tests must `await initDb(path)` in `beforeEach` and `closeDb()` in `afterEach`.
- `run()` does not call `saveDb()`: writes stay in memory until `closeDb()`.
- Express matches routes in order: register `/books/search` before `/books/:id`, or "search" is read as an id.
- SQLite `LIKE` ignores case for ASCII only, and treats `%` and `_` as wildcards unless the query uses `ESCAPE`.
