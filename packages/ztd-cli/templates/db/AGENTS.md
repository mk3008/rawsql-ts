# Database Guidance

- Keep `db/ddl` as the human-owned source of truth for schema shape.
- Make schema intent explicit in DDL before updating generated artifacts under `.ztd/`.
- Do not apply migrations automatically.
- After DDL edits, rerun `npx ztd ztd-config`, `npx ztd lint`, and the affected tests.

If you are unsure whether a change belongs in DDL or feature SQL, inspect the nearest feature folder first.
