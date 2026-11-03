---
name: adr
description: Write an Architecture Decision Record in docs/adr/ for a decision the user has made.
disable-model-invocation: true
argument-hint: <decision to record>
---

# Write an ADR

Decision to record: $ARGUMENTS

1. **Don't invent the decision.** If the arguments don't say what was decided and why, ask the user before writing (at most 3 questions): the decision, the problem that forced it, the alternatives they rejected.

2. **Ground the context in the code.** Read the files the decision touches and cite them by path (e.g. `src/db/index.ts`). State facts, not opinions.

3. **Number and file name.** Next number = highest in `docs/adr/` + 1, zero-padded to 3 digits. File: `docs/adr/NNN-kebab-case-title.md`.

4. **Format:** same structure as `docs/adr/001-architecture.md`.

   ```markdown
   # ADR-NNN: Title in a few words

   **Date:** YYYY-MM-DD
   **Status:** Proposed

   ## Context

   The problem and the forces at play. What is true today, with file paths.

   ## Decision

   One paragraph starting with "We will ...".

   ## Rationale

   Why this option. Then one line per rejected alternative: "Rejected: X, because Y."

   ## Trade-offs

   **Positive:**
   - ...

   **Negative:**
   - ... (with its mitigation, if any)
   ```

5. **Rules**
   - Every ADR has at least one negative trade-off. A decision with no cost isn't a decision.
   - Status starts as `Proposed`. Only the user moves it to `Accepted`.
   - If it replaces an earlier ADR, set the old one's status to `Superseded by ADR-NNN` and link both ways.
   - Keep it under one page. No implementation plan; that belongs in a brief.

6. **Finish** by showing the new file's path and a 3-line summary.
