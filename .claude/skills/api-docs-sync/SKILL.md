---
name: api-docs-sync
description: Use after creating, changing or deleting any route in src/routes/*.ts (JSON API or HTML pages), or when asked to sync or document the routes, to update the route tables in README.md so they match the code.
---

# Sync the README route docs with the code

The README is the contract students and agents read. It must list every route that exists, and nothing that doesn't.

1. **Build the inventory from the code, not from memory.**
   - Mount prefixes are in `src/server.ts`: `/` (books), `/shelves`, `/reviews`, `/api`.
   - List the handlers: `grep -nE "router\.(get|post|put|patch|delete)\(" src/routes/*.ts`
   - Full path = mount prefix + route path (`/api` + `/books/:id` = `/api/books/:id`).
   - Read each handler for: body fields it reads, success status, error statuses it returns, view or partial it renders.

2. **Replace everything between the markers in README.md:**
   `<!-- routes:start -->` ... `<!-- routes:end -->`
   If the markers don't exist yet, add them as a `### Routes` section inside "For AI Agents", right after the curl examples, replacing the line "See the API routes in `src/routes/api.ts` for full documentation."

3. **Format:** two tables, rows in the same order as the code.

   JSON API (`src/routes/api.ts`)

   | Method | Path | Body | Success | Errors |
   |---|---|---|---|---|
   | POST | `/api/reviews` | `userId`, `bookId`, `rating` (1–5), `reviewText?` | 201 review | 400, 409 |

   HTML pages (`src/routes/books.ts`, `shelves.ts`, `reviews.ts`)

   | Method | Path | Renders | Called by HTMX |
   |---|---|---|---|
   | GET | `/books/search` | search results partial | yes, from `books/index` |

   - Optional body fields end in `?`. Use `—` when there is no body.
   - Document what the code does today, gaps included (e.g. "TODO: returns a placeholder"). Do not change route code from this skill.

4. **Keep the curl examples valid.** If a route used in an existing curl example changed or was removed, update or remove the example.

5. **Verify:** the number of table rows must equal the number of handlers.
   - `grep -cE "router\.(get|post|put|patch|delete)\(" src/routes/*.ts` and sum the counts.
   - If the counts differ, find the missing route before finishing.
   - Report which routes were added, changed or removed in the README.
