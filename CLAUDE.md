# Agent Bookshelf

Goodreads-lite teaching app. Express 4 + TypeScript (strict, ESM) + sql.js (SQLite in WASM) + EJS/HTMX + Vitest/supertest. Node 24.

## Commands

- `npm run dev` — start with tsx watch on http://localhost:3000
- `npm run build` — tsc + copy SQL/views/public into `dist/`
- `npm run test:run` — run Vitest once (use this, not `npm test`, which watches)

## Map

- `src/db/index.ts` — the only DB layer: `initDb`, `all`, `get`, `run`, `saveDb`, `closeDb`
- `src/db/schema.sql`, `src/db/seed.sql` — schema and seed (50 books, 3 users, 9 shelves)
- `src/models/*.ts` — one module per table; plain functions, no classes
- `src/routes/api.ts` — JSON API under `/api`
- `src/routes/{books,shelves,reviews}.ts` — HTML routes rendering EJS
- `src/views/**` — pages include `partials/header` and `partials/footer`; `layout.ejs` is unused
- `tests/**/*.test.ts` — Vitest; each file inits its own DB

## Rules

1. Run `npm run test:run` before saying a task is done, and paste the pass/fail summary.
2. Relative TypeScript imports end in `.js` (`import * as Book from '../models/book.js'`).
3. Query the DB only through `all/get/run` from `src/db/index.ts` with `?` placeholders. Never interpolate request input into SQL strings.
4. Do not edit `src/db/schema.sql` or `src/db/seed.sql`. Tests depend on the seed counts. A PreToolUse hook blocks this.
5. JSON API errors use `res.status(code).json({ error: '...' })`: 400 invalid input, 404 not found, 409 conflict. Success: 201 on create, 204 on delete.
6. Routes hit by HTMX (`hx-get`, `hx-post`) return a partial (no header/footer), rendered into the `hx-target`.
7. No new npm dependencies without asking first.
8. The repo has deliberate homework gaps (search route, tests, validation, CSS). Do not fix a gap unless the task asks for it.
9. After adding, changing or removing a route in `src/routes/`, update the route tables in README.md (skill `api-docs-sync`).

## Gotchas

- `run()` does not call `saveDb()`: writes stay in memory until `closeDb()`.
- Tests must `await initDb(path)` in `beforeEach` and `closeDb()` in `afterEach`, with a DB path unique to that file.
