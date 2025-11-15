# @rawsql-ts/postgres-testkit

Postgres adapter utilities that rewrite `pg` `SELECT` queries with fixture-backed CTEs before invoking the real connection. The helpers rely on `@rawsql-ts/testkit-core` to validate schemas and inject fixture data safely.

## Installation

```bash
npm install @rawsql-ts/postgres-testkit pg
```

## `createPostgresSelectTestDriver`

```ts
import { Client } from 'pg';
import { createPostgresSelectTestDriver } from '@rawsql-ts/postgres-testkit';

const driver = createPostgresSelectTestDriver({
  connectionFactory: () => new Client({ connectionString: process.env.DATABASE_URL }),
  fixtures: [
    {
      tableName: 'accounts',
      rows: [{ id: 1, tier: 'pro' }],
      schema: {
        columns: {
          id: 'INTEGER',
          tier: 'TEXT',
        },
      },
    },
  ],
  missingFixtureStrategy: 'error',
});

await driver.query('SELECT tier FROM accounts');
await driver.close();
```

`createPostgresSelectTestDriver` rewrites and executes SELECT statements through the provided connection factory, and `withFixtures` returns a scoped driver with additional fixtures.

## `wrapPostgresDriver`

```ts
import { Client } from 'pg';
import { wrapPostgresDriver } from '@rawsql-ts/postgres-testkit';

const client = new Client();
await client.connect();

const wrapped = wrapPostgresDriver(client, {
  fixtures: [
    { tableName: 'products', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } },
  ],
  recordQueries: true,
  onExecute(sql, params) {
    console.log('[sql]', sql, params);
  },
});

await wrapped.query('SELECT * FROM products');
console.log(wrapped.queries);
await wrapped.end?.();
```

The proxy rewrites SELECT statements while leaving INSERT/UPDATE/DELETE untouched, supports query logging when `recordQueries` is enabled, and exposes a `withFixtures` helper for scoped overrides.

# CUD pipeline and TableDef snapshots

`wrapPostgresDriver` now stitches together three routes before handing SQL to the real connection:

- **SELECT** statements go through `SelectFixtureRewriter` so fixture-backed CTEs shadow the real tables.
- **INSERT** statements are rewritten by `TestkitDbAdapter` (only when you pass `tableDefs`) into `INSERT ... SELECT` payloads with optional CASTs and validation.
- **Everything else** (UPDATE, DELETE, DDL, EXECUTE, etc.) bypasses the rewrite layer and executes untouched.

### Driver integration flow

This adapter splits responsibilities to keep the CRUD pipeline table-independent:

1. **SELECT** rewrites follow the same fixture-backed flow as `createPostgresSelectTestDriver`.
2. **INSERT** statements reach `TestkitDbAdapter` when `tableDefs` metadata is present. The adapter normalizes VALUES → SELECT, attaches CASTs, and runs `validateInsertShape`/`validateDtoSelectRuntime`. Validation failures throw `CudValidationError`, which carries an `issues` array (`{ kind, column, message }`) so downstream code can surface structured diagnostics or rethrow a human-friendly message.
3. **Other statements** (UPDATE/DELETE/DDL) skip rewriting altogether so they execute against the native connection unless you override the proxy behavior manually.

`wrapPostgresDriver` propagates `cudOptions` to `TestkitDbAdapter`, so `enableTypeCasts`, `enableRuntimeDtoValidation`, and `failOnShapeIssues` remain consistent between the wrapper and the AST-driven pipeline. `wrapSqliteDriver` mirrors the same option plumbing so both drivers honor the same flags, diagnostics, and passthrough contracts.

Provide the schema metadata that powers the `TestkitDbAdapter` by passing `tableDefs: TableDef[]`. Each snapshot pairs a `tableName` with a column list (`name`, `dbType`, `nullable`, and optional `hasDefault`)—these snapshots can be hand-written, reverse-generated, or automatically emitted by the CLI (`pnpm --filter @rawsql-ts/postgres-testkit run schema:generate ...`). Store them alongside your fixtures so downstream adapters never query `information_schema`.

Use `cudOptions` to control `TestkitDbAdapter` behaviors:

| Option | Default | Description |
| --- | --- | --- |
| `enableTypeCasts` | `true` | Wrap each SELECT payload element with a CAST to the column’s `dbType`. |
| `enableRuntimeDtoValidation` | `true` | Enforce that DTO-based INSERT SELECTs include a FROM clause; disable to let DTO-driven payloads run unchanged. |
| `failOnShapeIssues` | `true` | Throw `CudValidationError` when the INSERT supplies missing/extra columns; set to `false` to let the original SQL run untouched. |

`CudValidationError` includes an `issues` array of `{ kind, column, message }` diagnostics so calling code can render structured hints or surface telemetry.

Postgres-specific column types such as `NUMERIC`, `JSONB`, or `ENUM` currently flow through the pipeline as the literal `dbType` text, so any tailored CAST or validation logic for those types is a future extensibility point you can layer on top of the existing model.

### Positional parameters and dynamic filters

`wrapPostgresDriver` (and the underlying rewrite pipeline) uses the AST-based builders from `@rawsql-ts/core`. When you apply a `filter` object to a query that already uses Postgres-style indexed parameters, the dynamic conditions are injected with their own `$n` placeholders, and the old indexes are renumbered accordingly.

For example:

```sql
with a as (select id, name from table_a)
select * from a where id = $1
```

Applying the filter `{ id: 1, name: 'Alice' }` produces:

```sql
with "a" as (select "id", "name" from "table_a" where "name" = $1)
select * from "a" where "id" = $2
```

The parameter array becomes `['Alice', 1]`, because the injected `name` comparison now owns `$1` and the original `id = $1` shifted to `$2`. This is intentional: dynamic filters target the columns that are not already bound and are appended in the order the builder sees them, so the grid of `$n` indexes simply reflects the rewritten WHERE clauses rather than preserving the original numbering.

When you can choose, prefer named placeholders so the filter keys line up with the column names you are targeting. DynamicQueryBuilder still treats indexed placeholders as if they were keyed by the assignment column, but the AST can only recover those column names in very simple comparisons. Any arithmetic or function call around the column hides the target and leaves the placeholder unresolved, which makes indexed styles fragile unless the SQL stays very plain. Drivers such as `pg` that require index-style binds therefore remain compatible, but they inherit these limitations when the SQL contains hardcoded parameters.

Because the rewrite pipeline renumbers existing positional parameters and relies on column names to drive the dynamic filter injection, you cannot satisfy a hardcoded placeholder by specifying its original `$n` slot. Write the filters by column name (e.g., `filter: { id: 10 }`) rather than by placeholder (`filter: { '$1': 10 }`) so the builder can align the condition with the rewritten statement.

If a hardcoded placeholder remains without a matching filter value, the builder raises a `Missing values for hardcoded placeholders` error before execution, mirroring the behavior in `packages/core/tests/utils/ParameterDetector.test.ts`. Make sure every placeholder in your SQL has a corresponding filter entry or remove the placeholder entirely.

If you previously saw redundant rewrites like `... id = $1 and id = :id`, this rewrite was caused by treating the column as both a hardcoded parameter and a dynamic filter. `ParameterDetector` now maps the column to its existing `$n` placeholder before splitting the filters, so only truly new conditions add new `$n` bindings.

## Schema generation

Use the built-in CLI to materialize a JSON schema map directly from a Postgres database.

```bash
pnpm --filter @rawsql-ts/postgres-testkit run schema:generate -- --connection postgresql://user:pass@localhost/dbname --output schema.json
```

Add `--tables` to limit the result to specific `schema.table` targets (or unqualified table names), and append `--per-table` to emit one file per table. The output keys already include the schema name so fixtures can target the correct namespace.

## Publishing

Run `npm run release` from `packages/drivers/postgres-testkit` to lint, test, build, verify `npm pack --dry-run`, and publish with `--access public`.

## Demo

- Browse `packages/drivers/postgres-testkit/demo/README.md` for a guided repository-level walkthrough built around `wrapPostgresDriver`.
- Two Vitest suites live under `demo/tests/`; run them with `pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-intercept.test.ts` (intercept path) and `... customer-physical.test.ts` (baseline).
