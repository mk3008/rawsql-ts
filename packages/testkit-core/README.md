# @rawsql-ts/testkit-core

Pure TypeScript utilities that help rewrite SELECT statements with fixture-backed CTEs so SQLite drivers can run deterministic unit tests.

## Features

- Validates fixture rows against declarative schemas (or registry lookups).
- Injects rewritten `WITH` clauses without touching the original query shape.
- Supports fail-fast, passthrough, or warn-on-missing fixture strategies.
- Supplies building blocks for driver adapters (see `@rawsql-ts/sqlite-testkit`).

## Usage

```ts
import { SelectFixtureRewriter } from '@rawsql-ts/testkit-core';

const rewriter = new SelectFixtureRewriter({
  fixtures: [
    {
      tableName: 'users',
      rows: [{ id: 1, name: 'Alice' }],
      schema: {
        columns: {
          id: 'INTEGER',
          name: 'TEXT',
        },
      },
    },
  ],
});

const { sql } = rewriter.rewrite('SELECT id, name FROM users');
```

## DAL 1.0 CUD pipeline coverage

`testkit-core` now ships with CUD helpers and the `TestkitDbAdapter` that rewrite `INSERT` statements into `INSERT ... SELECT`, apply casts, and run shape/runtime validation solely via in-memory `TableDef` snapshots. The adapter never queries `information_schema`, `pg_catalog`, or any live tables—every schema lookup is derived from the provided `TableDef`.

### TableDef requirements

- `columns`: array of column definitions with the minimal properties `name`, `dbType`, `nullable`, and optional `default` or `hasDefault`.
- Each column’s `dbType` text is used directly when applying CASTs inside the rewrite pipeline.
- TableDef snapshots may be hand-written for new entities, reverse-generated from existing schemas (e.g., `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns`), or produced by custom scripts; store them in a shared workspace folder and commit them alongside repository fixtures.
- `TestkitDbAdapter` consumes `TableDef` to validate INSERT shapes, plan column order, and attach CAST expressions before the final SQL is executed.

### Preparing TableDef snapshots

- Keep each snapshot as a standalone `TableDef` that lists the `tableName` plus the columns you intend to validate (including `dbType`, `nullable`, and `hasDefault`). Those definitions are intentionally minimal so tests stay fast and portable.
- Generate snapshots from Postgres via the CLI (`pnpm --filter @rawsql-ts/postgres-testkit run schema:generate -- --connection postgresql://... --output schema.json`). Add `--tables`/`--per-table` when you only need a subset, then commit the artifacts next to your fixtures so downstream drivers can consume them.
- Pass the populated `TableDef[]` to `TestkitDbAdapter` (or directly to `wrapPostgresDriver`/`wrapSqliteDriver` via their `tableDefs` option) when you want INSERT statements to obey the AST-driven rewrite pipeline.
- If schema metadata is unavailable, leave `tableDefs` undefined so the adapter falls back to letting INSERT/UPDATE/DELETE hit the real connection unchanged.

### Option reference

- `enableTypeCasts` (default `true`): wrap each SELECT value with a CAST to the column’s `dbType`.
- `enableRuntimeDtoValidation` (default `true`): ensure DTO-derived SELECTs include a FROM clause before execution.
- `failOnShapeIssues`: when `true`, `CudValidationError` is thrown for missing or extra columns; otherwise, you can log warnings or fall back to passthrough behavior downstream.
  - When `failOnShapeIssues` is `false`, `TestkitDbAdapter` returns `null` so callers can let the native driver execute the original SQL and handle retired diagnostics.

Because `TestkitDbAdapter` surfaces `CudValidationError` (which carries an `issues` array of `{ kind, column, message }` diagnostics), downstream drivers can either bubble the exception or convert it into structured telemetry. The Postgres and SQLite helpers both honor the same option names via their `cudOptions` knobs so the behavior stays consistent across adapters.

Integration tests under `packages/testkit-core/tests/cud/` cover VALUES normalization, CAST injection, DTO validation, and the adapter pipeline to keep downstream drivers table-independent while honoring the DAL1.0 CUD strategy.
