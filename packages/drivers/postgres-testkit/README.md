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
