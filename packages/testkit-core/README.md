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

- `columns`: array of column definitions with the minimal properties `name`, `dbType`, `nullable`, and optional `default` or `hasDefault`. Include only the columns your INSERTs cover so the helpers stay fast, and note that primary key metadata is optional—the INSERT-focused pipeline never requires it, though you can append PK/unique information later if UPDATE/DELETE support needs it.
- Use the literal `dbType` strings directly when applying CASTS; the same identifier is echoed back into the rewritten SQL.
- Snapshots may be created manually, reverse-generated (`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns`), or emitted via scripts/CLI. Save them beside your fixtures or in a shared schema folder so every driver (sqlite/Postgres) can reuse the same metadata without hitting live tables.
- `TestkitDbAdapter` consumes `TableDef` data to determine column order, detect missing/extra fields, and attach CAST expressions before the final SQL is executed, keeping the pipeline table-independent.

### Preparing TableDef snapshots

- Keep each snapshot as a standalone `TableDef` that lists the `tableName` plus the columns you intend to validate (including `dbType`, `nullable`, and `hasDefault`). Those definitions are intentionally minimal so tests stay fast and portable.
- Generate snapshots from Postgres via the CLI (`pnpm --filter @rawsql-ts/postgres-testkit run schema:generate -- --connection postgresql://... --output schema.json`). Add `--tables`/`--per-table` when you only need a subset, then commit the artifacts next to your fixtures so downstream drivers can consume them.
- Pass the populated `TableDef[]` to `TestkitDbAdapter` (or directly to `wrapPostgresDriver`/`wrapSqliteDriver` via their `tableDefs` option) when you want INSERT statements to obey the AST-driven rewrite pipeline.
- Keep those TableDef arrays in a shared module or JSON map so both the Postgres and sqlite helpers can import them and reuse the same metadata across adapters.
- If schema metadata is unavailable, leave `tableDefs` undefined so the adapter falls back to letting INSERT/UPDATE/DELETE hit the real connection unchanged.

### Option reference

- `enableTypeCasts` (default `true`): wrap each SELECT value with a CAST to the column’s `dbType`.
- `enableRuntimeDtoValidation` (default `true`): ensure DTO-derived SELECTs include a FROM clause before execution and catch NULL assignments or CAST mismatches against the provided `TableDef`.
- Runtime DTO validation exists because FROM-less SELECTs represent the standard DTO shape, and the guard keeps those scalars from bypassing the nullability and type constraints a real table imposes.
- `failOnShapeIssues`: when `true`, `CudValidationError` is thrown for missing or extra columns; otherwise, you can log warnings or fall back to passthrough behavior downstream.
  - When `failOnShapeIssues` is `false`, `TestkitDbAdapter` returns `null` so callers can let the native driver execute the original SQL and handle retired diagnostics.

Because `TestkitDbAdapter` surfaces `CudValidationError` (which carries an `issues` array of `{ kind, column, message }` diagnostics), downstream drivers can either bubble the exception or convert it into structured telemetry. The Postgres and SQLite helpers both honor the same option names via their `cudOptions` knobs so the behavior stays consistent across adapters.

When tableDefs are missing or you configure a passthrough path (e.g., `failOnShapeIssues: false` or parsing failures), `TestkitDbAdapter.rewriteInsert` returns `null` so the native driver executes the original SQL unchanged.

Integration tests under `packages/testkit-core/tests/cud/` cover VALUES normalization, CAST injection, DTO validation, and the adapter pipeline to keep downstream drivers table-independent while honoring the DAL1.0 CUD strategy.

### Simulating INSERT ... RETURNING

`TestkitDbAdapter` can now synthesize `RETURNING` rows entirely from the DTO `SELECT` that it builds during normalization. When downstream drivers such as `wrapPostgresDriver` enable DAL CUD simulation mode, the adapter evaluates the DTO rows, enforces the `TableDef` constraints (missing columns, NOT NULL violations, casts), and returns deterministic payloads (auto-number columns use a stable counter). This keeps repository tests fully detached from real tables: the underlying connection only needs to accept the rewritten SQL, while the Testkit pipeline feeds the caller the expected result row.
