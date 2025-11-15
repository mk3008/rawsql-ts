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

### Option reference

- `enableTypeCasts` (default `true`): wrap each SELECT value with a CAST to the column’s `dbType`.
- `enableRuntimeDtoValidation` (default `true`): ensure DTO-derived SELECTs include a FROM clause before execution.
- `failOnShapeIssues`: when `true`, `CudValidationError` is thrown for missing or extra columns; otherwise, you can log warnings or fall back to passthrough behavior downstream.

Integration tests under `packages/testkit-core/tests/cud/` cover VALUES normalization, CAST injection, DTO validation, and the adapter pipeline to keep downstream drivers table-independent while honoring the DAL1.0 CUD strategy.
