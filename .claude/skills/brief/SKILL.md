---
name: brief
description: Turn a vague request into a verifiable 5-part brief (outcome, context, constraints, done when, verify) before any code is written.
disable-model-invocation: true
argument-hint: <what you want done>
---

# Write a brief before doing the work

Request: $ARGUMENTS

The goal is a spec the agent can check itself against. Don't edit any file while running this skill.

1. **Gather context, read-only.** Find the code the request touches: routes, models, views, tests. Check `git status`. Note what already exists (e.g. a model function the route only needs to call).

2. **One outcome.** If the request holds more than one deliverable (an "and"), write one brief per deliverable and say in which order to run them.

3. **Write the brief in exactly this shape:**

   ```
   <One sentence: the single outcome.>

   Context: where the code lives, what exists, what was tried, what it touches (file paths).
   Constraints: what not to touch. Defaults from CLAUDE.md: no edits to schema.sql or seed.sql,
     no new dependencies, don't fix unrelated homework gaps. Add task-specific ones.
   Done when: measurable exit criteria — inputs, expected outputs, edge cases. Never "it works".
   Verify: the exact command(s) the agent runs itself, e.g. `npm run test:run`,
     and which new test cases must exist.
   ```

4. **Open questions.** List the assumptions you made and anything only the user can decide. If an answer would change the outcome, ask instead of assuming.

5. **Stop.** Show the brief and ask whether to execute it as written. Don't start the work in the same turn.

## Example

> Implement the book search backend.
>
> Context: the UI exists; the route in `src/routes/books.ts` is a TODO. `searchBooks()` already exists in `src/models/book.ts`. SQLite via sql.js.
> Constraints: no schema changes, no new dependencies.
> Done when: a query from the existing search box returns case-insensitive title and author matches; an empty query returns all books.
> Verify: add Vitest cases under `tests/` and run `npm run test:run` until it passes.
