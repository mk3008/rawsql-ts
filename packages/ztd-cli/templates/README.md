# Zero Table Dependency Project

This project organizes SQL artifacts under `sql/` so each concern gets its own folder:
- `sql/ddl/` keeps CREATE/ALTER TABLE statements plus indexes and constraints.
- `sql/enums/` holds domain enums and value lists.
- `sql/domain-specs/` documents executable SELECT-based domain behaviors.

`tests/ztd-layout.generated.ts` declares the directories above so the CLI and your tests always point at the right source files.

## Workflow

1. Edit `sql/ddl/schema.sql` to declare tables and indexes.
2. Run `npx ztd ztd-config` (or `--watch`) to refresh `tests/ztd-row-map.generated.ts`.
3. Build tests and fixtures that consume `TestRowMap`.
4. Execute tests via `pg-testkit` or another driver so the rewrite pipeline stays intact.
