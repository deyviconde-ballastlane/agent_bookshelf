# SPEC · BOOK-101 · Search books by title or author

## Outcome

A visitor types in the search box on the books page and sees the books whose title or author contains that text. The same search is available as JSON.

## Context

- The search box already exists in `src/views/books/index.ejs`. HTMX sends `GET /books/search?q=…` and swaps the response into `#search-results`.
- That route is a stub in `src/routes/books.ts`. It ignores `q` and returns a "coming soon" message.
- `searchBooks(query)` already exists in `src/models/book.ts`. It runs a parameterised `LIKE`, but it does not trim, has no length limit, and treats `%` and `_` in the query as wildcards.
- All database access goes through `all`, `get` and `run` in `src/db/index.ts` (sql.js). SQLite `LIKE` is case-insensitive for ASCII letters only.
- The JSON API in `src/routes/api.ts` returns bare arrays for lists and `{ "error": "…" }` with a 4xx status for errors.

## Interface

The ticket left this field blank (`[endpoint and response shape]`), so this spec fixes it. Everything is additive: no existing route, exported function or response changes shape.

| Surface | Call | Success | Validation error |
|---|---|---|---|
| Model | `searchBooks(query: string): Book[]` in `src/models/book.ts` | Array of books ordered by title | Throws `SearchValidationError` |
| JSON | `GET /api/books/search?q=<text>` | `200`, `Book[]` (same shape as `GET /api/books`) | `400`, `{ "error": string }` |
| JSON alias | `GET /api/books?q=<text>` | Same as above. Without `q` it behaves exactly as today. | Same as above |
| HTML | `GET /books/search?q=<text>` | `200`, a partial with the same `.book-grid` cards as the books page, no header or footer | `400`, `<p class="error">…</p>` |

`src/models/book.ts` also exports `MAX_SEARCH_LENGTH = 100` and `class SearchValidationError extends Error` (its `name` is `'SearchValidationError'`).

## Rules

The rules live in the model, so every surface behaves the same.

1. **Trim first.** Leading and trailing whitespace is removed before anything else.
2. **Empty returns everything.** An empty query, a whitespace-only query or a missing `q` returns all books, ordered by title.
3. **Length limit.** A query longer than 100 characters after trimming is a validation error. Exactly 100 characters is valid.
4. **Match.** A book matches when the trimmed text appears anywhere in its `title` or in its `author`, ignoring ASCII case.
5. **Literal wildcards.** `%` and `_` in the query match themselves. They are not wildcards.
6. **Parameterised SQL.** The query text reaches SQLite only through `?` placeholders. It never appears inside the SQL string.
7. **No match is not an error.** The model and the JSON routes return an empty array with `200`. The HTML route returns `200` with a "no books found" message.
8. **One string only.** A `q` that is not a single string (`?q=a&q=b`, `?q[x]=1`) is a validation error.

## Constraints

- No schema changes and no new dependencies. `package.json` and `package-lock.json` do not change.
- Never touch `bookshelf.db`, `src/db/seed.sql`, `src/db/schema.sql` or `.env`. A hook blocks it.
- Existing routes, exports and response shapes stay exactly as they are. The 14 existing tests keep passing unedited.
- Tests are written first, from this spec, and stay read-only while the implementation is written.

## Out of scope

- Ranking, pagination, fuzzy matching and multi-word matching (`dune herbert`).
- Case folding beyond ASCII (`É` does not match `é`).
- Validation gaps in other endpoints and the other deliberate gaps in this repo.

## Files

- `src/models/book.ts`: the rules above, in `searchBooks`.
- `src/routes/api.ts`: `GET /books/search` (registered before `/books/:id`) and the `q` alias on `GET /books`.
- `src/routes/books.ts`: the real `GET /books/search`.
- `src/views/books/`: a partial for the results, reused by the books page if that is simpler.
- `tests/`: new test files only. One test per rule per surface where the rule applies.
- `README.md`: the two new JSON routes in the API section.

## Done when

1. New Vitest tests cover rules 1 to 8, were written before the implementation, and failed for the right reason first.
2. `npm run test:run` passes, including the 14 tests that existed before.
3. The diff against `main` touches only the files listed above, plus the setup files (`SPEC.md`, `CLAUDE.md`, `.claude/`, `ticket-to-merge/`).

## Verify

```
npm run test:run
git diff --stat main -- src/db package.json package-lock.json    # must print nothing
```
