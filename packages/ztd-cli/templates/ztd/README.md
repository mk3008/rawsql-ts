# ZTD Definitions

This directory hosts the schema definitions under `ztd/ddl/`. Every DDL file in that folder is the single source of truth for database objects; parser tools and tests read these files to learn table structures, columns, indexes, and constraints.

## DDL Guidelines

- Place every schema definition under `ztd/ddl/` with valid PostgreSQL and semicolon-terminated statements.
- Keep the files deterministic: avoid generated output, enforce column ordering, and document any non-obvious constraints with comments.
- When you rename or drop a column, update the corresponding DDL file rather than trying to patch test artifacts manually.
- Treat `ztd/ddl/` as a human-maintained catalog; AI may assist but must not invent or diverge from the files stored there.

## Workflow expectations

- Regenerate `tests/generated/ztd-row-map.generated.ts` via `npx ztd ztd-config` whenever the DDL changes.
- Do not assume any other subdirectories under `/ztd` exist unless a human has explicitly created them for a specific purpose.
