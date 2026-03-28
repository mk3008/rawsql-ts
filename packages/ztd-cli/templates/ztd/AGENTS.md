# ZTD Guidance

- Keep `ztd/ddl` as the source of truth for schema shape.
- Make schema intent explicit in DDL before updating generated artifacts.
- Do not apply migrations automatically.
- After DDL edits, rerun `npx ztd ztd-config`, `npx ztd lint`, and the affected tests.

If you are unsure whether a change belongs in DDL or feature SQL, inspect the nearest feature folder first.
