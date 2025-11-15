# @rawsql-ts/sqlite-testkit

SQLite adapter utilities that let you run repository tests entirely in-memory by shadowing tables with fixture-backed CTEs. The package builds on `@rawsql-ts/testkit-core` for schema validation and SQL rewrites.

## Installation

```bash
npm install @rawsql-ts/sqlite-testkit
```

## `createSqliteSelectTestDriver`

```ts
import Database from 'better-sqlite3';
import { createSqliteSelectTestDriver } from '@rawsql-ts/sqlite-testkit';

const tableSchemas = {
  users: {
    columns: {
      id: 'INTEGER',
      name: 'TEXT',
      role: 'TEXT',
    },
  },
};

const schemaRegistry = {
  getTable(name: string) {
    return tableSchemas[name as keyof typeof tableSchemas];
  },
};

const driver = createSqliteSelectTestDriver({
  connectionFactory: () => new Database(':memory:'),
  fixtures: [
    {
      tableName: 'users',
      rows: [{ id: 1, name: 'Alice', role: 'admin' }],
    },
  ],
  schema: schemaRegistry,
  missingFixtureStrategy: 'error',
});

const rows = await driver.query('SELECT * FROM users');
```

Use `driver.withFixtures([...])` to derive a scoped driver with scenario-specific fixture overrides, and call `driver.close()` to dispose the underlying connection when the suite finishes.

> ℹ️ You can still pass `schema` per fixture for quick experiments, but providing a registry once via the top-level `schema` option keeps large suites maintainable and consistent.

## `wrapSqliteDriver`

Turn any existing `better-sqlite3` connection into a transparent proxy that:

- intercepts `prepare`, `exec`, `all`, `get`, and `run`
- rewrites incoming `SELECT` statements into fixture-backed CTEs (and passes through everything else)
- leaves the underlying repository or DAO code untouched

In other words, you can keep your production query paths as-is and only override read queries during tests.

```ts
import Database from 'better-sqlite3';
import { wrapSqliteDriver } from '@rawsql-ts/sqlite-testkit';

const raw = new Database(':memory:');
const intercepted = wrapSqliteDriver(raw, {
  fixtures: [
    { tableName: 'orders', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } },
  ],
  missingFixtureStrategy: 'warn',
  recordQueries: true,
  onExecute(sql, params) {
    console.log(`[sql] ${sql}`, params);
  },
});

intercepted.prepare('SELECT * FROM orders').all();

// Inspect the final SQL emitted during the test
console.log(intercepted.queries);
```

Call `intercepted.withFixtures([...])` to create an isolated proxy that applies additional fixtures on top of the base configuration.

## CUD pipeline and TableDef snapshots

`wrapSqliteDriver` keeps a similar call-routing strategy to the Postgres helper:

+- **SELECT** statements are rewritten through `SelectFixtureRewriter` and the fixture-backed CTEs you supply.
+- **INSERT** statements go through `TestkitDbAdapter` (when you provide schema metadata via `tableDefs`) so they can be normalized to `INSERT ... SELECT`, casted, and validated without touching a real table.
+- **Any other statement** runs unchanged on the underlying SQLite connection.

### Driver integration flow

The sqlite helper mirrors the Postgres logic:

1. SELECT queries are rewritten through `SelectFixtureRewriter` as usual.
2. INSERT statements leverage `TestkitDbAdapter` when `tableDefs` exist, passing along `enableTypeCasts`, `enableRuntimeDtoValidation`, and `failOnShapeIssues`. Validation errors throw `CudValidationError` with structured `{ kind, column, message }` diagnostics before anything touches the real connection.
3. UPDATE, DELETE, and other statements bypass the rewrite layer so they hit the native driver directly unless you override the proxy manually.

The same `cudOptions` plumbing ensures cast/validation flags and error propagation behave identically between Postgres and sqlite wrappers.

To enable the CUD pipeline, pass `tableDefs: TableDef[]` where each entry captures the `tableName` plus its columns (`name`, `dbType`, `nullable`, and optional `hasDefault`). You can generate those snapshots with the Postgres schema CLI (`pnpm --filter @rawsql-ts/postgres-testkit run schema:generate ...`), keep the resulting JSON/TS definitions near your fixtures, and share them between the Postgres and SQLite stacks so both adapters reuse the same metadata.

Shape/runtime rewrites honour the `cudOptions` configuration:

| Option | Default | Description |
| --- | --- | --- |
| `enableTypeCasts` | `true` | Wrap each SELECT value with a CAST to the column’s `dbType`. |
| `enableRuntimeDtoValidation` | `true` | Reject DTO-based SELECTs without a FROM clause; disable to opt out. |
| `failOnShapeIssues` | `true` | Throw `CudValidationError` when columns are missing/extra; set to `false` to pass the SQL through unchanged. |

`CudValidationError` carries an `issues` array with `{ kind, column, message }` entries so you can render human-friendly hints or surface structured telemetry from your integration layer.

## Publishing

Run `npm run release` from `packages/drivers/sqlite-testkit` to execute lint, test, build, `npm pack --dry-run`, and `npm publish --access public`. This mirrors the core package release workflow and lets you publish `@rawsql-ts/sqlite-testkit` directly after bumping the version.
