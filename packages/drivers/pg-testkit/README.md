# @rawsql-ts/pg-testkit

Postgres adapter utilities that let you exercise SQL-heavy repositories without provisioning physical tables. CRUD statements are rewritten into fixture-backed `WITH` queries and executed on a real `pg` connection so query plans, type casts, and parameter handling still round-trip through the database engine.

## Installation

```bash
npm install @rawsql-ts/pg-testkit
```

## `createPgTestkitClient`

Create an isolated client that lazily opens a `pg` connection and rewrites every incoming query. Use `tableDefinitions` for schema hints and `tableRows` for the inline data that shadows real tables.

```ts
import { Client } from 'pg';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';

const client = createPgTestkitClient({
  connectionFactory: () => new Client({ connectionString: process.env.PG_URL! }),
  tableDefinitions: [
    {
      name: 'users',
      columns: [
        { name: 'id', typeName: 'int', required: true },
        { name: 'email', typeName: 'text' },
      ],
    },
  ],
  tableRows: [
    {
      tableName: 'users',
      rows: [{ id: 1, email: 'alice@example.com' }],
    },
  ],
});

const result = await client.query('select email from users where id = $1', [1]);
console.log(result.rows); // => [{ email: 'alice@example.com' }]
```

Use `client.withFixtures([...])` to derive a scoped view that layers scenario-specific row fixtures on top of the base configuration.

## `createPgTestkitPool`

For suites that already rely on `pg.Pool`, this helper produces a pool where every connection runs through pg-testkit while transaction and savepoint commands still execute on the raw client.

```ts
import { createPgTestkitPool } from '@rawsql-ts/pg-testkit';

const pool = createPgTestkitPool(process.env.PG_URL!, {
  tableDefinitions: [
    {
      name: 'users',
      columns: [
        { name: 'id', typeName: 'int', required: true },
        { name: 'email', typeName: 'text' },
      ],
    },
  ],
  tableRows: [
    { tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] },
  ],
});

const rows = await pool.query('select email from users where id = $1', [1]);
console.log(rows.rows); // => [{ email: 'alice@example.com' }]

`createPgTestkitPool` accepts multiple row fixtures and option objects, so layer additional datasets by appending more `tableRows` or by supplying overrides via the options object.
```

## `wrapPgClient`

Wrap an existing `pg.Client`/`pg.Pool` instance so consumers can keep calling `.query` unchanged while fixtures inject CTEs under the hood.

```ts
import { Client } from 'pg';
import { wrapPgClient } from '@rawsql-ts/pg-testkit';

const raw = new Client({ connectionString: process.env.PG_URL! });
await raw.connect();

const wrapped = wrapPgClient(raw, {
  tableDefinitions: [
    {
      name: 'orders',
      columns: [
        { name: 'id', typeName: 'int' },
        { name: 'total', typeName: 'numeric' },
      ],
    },
  ],
  tableRows: [{ tableName: 'orders', rows: [{ id: 42, total: 199.99 }] }],
});

const rows = await wrapped.query('select id, total from orders where id = $1', [42]);
console.log(rows.rows); // => [{ id: 42, total: '199.99' }]
```

Call `wrapped.withFixtures([...])` to produce an isolated proxy that shadows different tables while reusing the same underlying connection.

## DDL-based fixtures

`ddl`-driven fixtures answer the "why not just use schema files?" question head on:

1. Your migration tooling, design docs, and pg-testkit all read the same DDL, keeping tests in lockstep with the real schema.
2. A single source of truth eliminates the need to hand-write table/column metadata for every fixture.
3. Comparing the files that migrations and pg-testkit both consume closes the gap between the evolving schema and what tests expect.

Housing schema files under `sql/ddl/<schema>.sql` (for example, `sql/ddl/users.sql`, `sql/ddl/orders.sql`) keeps each namespace in a predictable spot and makes it obvious which tables exist alongside their seeds. Each `.sql` file can contain `CREATE TABLE` statements plus optional `INSERT` statements, and the loader turns those inserts into fixture rows so your tests reuse the seeds declared next to the schema.

Point pg-testkit at those directories through the `ddl` option and it will parse every `CREATE TABLE`/`INSERT` before rewriting the first query; the DDL is loaded once per `PgTestkitClient`/`wrapPgClient` instance (or per pool client) so the schema snapshot remains stable until you rebuild the driver. Because pg-testkit runs before every rewrite, temporary tables needed by queries keep working too.

When you supply `ddl.directories`, each directory is walked recursively so subfolders are scanned the same as the root. The default extensions filter is `['.sql']`, but you can configure `ddl.extensions` to pull from alternate suffixes. Files are parsed via `DDLToFixtureConverter`, so every `CREATE TABLE`/`INSERT` statement inside a file produces a fixture entry regardless of the file name; however, keeping the file name close to the table(s) it defines (for example `users.sql` covering the `users` table) makes navigation easier. A single file may declare multiple tables, and the loader skips duplicate table names (case-insensitively) to prevent accidental overrides.

> **Schema-first guidance:** Treat the DDL files as the authoritative, project-wide schema definition, and keep test-case–specific seed data in the consuming tests. INSERT statements in the DDL are supported, but they should only define shared baseline data that truly belongs next to the schema (for example, critical lookup rows that every suite needs). Avoid scattering per-test fixtures across many DDL files, because that can make the fixtures harder to evolve alongside the tests. When you do rely on DDL INSERTs, document the exceptional nature of that data in the file so readers understand it is not the default workflow.

```ts
import { Client } from 'pg';
import { createPgTestkitClient, createPgTestkitPool, wrapPgClient } from '@rawsql-ts/pg-testkit';
import path from 'node:path';

const ddlPath = path.join(__dirname, '..', 'sql', 'ddl');
const tableDefinitions = [
  {
    name: 'users',
    columns: [
      { name: 'id', typeName: 'int', required: true },
      { name: 'email', typeName: 'text' },
    ],
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', typeName: 'int' },
      { name: 'total', typeName: 'numeric' },
    ],
  },
];

const manualRows = [
  { tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] },
  { tableName: 'orders', rows: [{ id: 42, total: 199.99 }] },
];

const client = createPgTestkitClient({
  connectionFactory: () => new Client({ connectionString: process.env.PG_URL! }),
  tableDefinitions,
  tableRows: manualRows,
  ddl: { directories: [ddlPath] },
});

const pooled = createPgTestkitPool(process.env.PG_URL!, {
  tableDefinitions,
  tableRows: manualRows,
  ddl: { directories: [ddlPath] },
});

const raw = new Client({ connectionString: process.env.PG_URL! });
await raw.connect();
const wrapped = wrapPgClient(raw, {
  tableDefinitions,
  tableRows: manualRows,
  ddl: { directories: [ddlPath] },
});
```

The loader kicks in for `wrapPgClient` too, so you can mix DDL-driven fixtures with manually supplied overrides or scenario-specific `withFixtures` overlays. INSERT statements in your `.sql` files are treated as fixture rows, preserving seed data and letting DDL files serve double duty as documentation and data definition.

## Fixture precedence

Fixtures compose in layers, and later layers override earlier ones to keep intent clear:

1. DDL-driven fixtures are parsed first when the client/pool/wrapper is constructed, so the canonical schema is always available before any manual overrides.
2. Table definitions/rows provided directly to `createPgTestkitClient`, `createPgTestkitPool`, or `wrapPgClient` are merged after the DDL inputs, letting you tweak data or column details without editing the schema files.
3. `withFixtures` overlays the resulting driver with scenario-specific data, so its rows and columns take priority for the lifetime of that scoped client.

When you instantiate a new driver (pool client, wrapped client, or scoped client via `withFixtures`), the DDL loader runs before the first rewrite and then the manually supplied fixtures plus the scoped fixtures layer on top before each query executes.

## Testing

The pg-testkit package has no persistent tables or shared schema state, so Vitest is free to run suites in parallel. The workspace `vitest.config.ts` keeps the default worker/threads settings and relies on the shared Dockerized Postgres container from `vitest.global-setup.ts`, but every test run routes through `createPgTestkitPool` and the fixture runner so each file/query works against its own isolated dataset. Feel free to run `pnpm --filter @rawsql-ts/pg-testkit test` (or `vitest` directly) without forcing serial execution.

## Notes

- **Parameter handling**
  - `$1`-style placeholders are normalized before rewriting so parser limitations do not block fixtures; pg-testkit restores the original numbering before executing the query.

- **DDL behavior**
  - Only `CREATE TEMPORARY ... AS SELECT` survives the rewrite pipeline because those statements pre-populate temp tables relied upon by later queries; dropping them would break SQL that expects the temporary table to exist.
  - INSERT statements found in the DDL files become fixture rows, letting migrations double as seed data without extra glue.
  - The loader parses directories once when the client/pool/wrapper is constructed, so recreate the driver if the underlying DDL changes.

- **Sequence defaults**
  - Defaults that invoke `nextval` are rewritten into deterministic expressions (e.g., `row_number() over ()`) during the pg-testkit conversion, eliminating the need to publish the sequence definition in the PostgreSQL cluster for INSERT/RETURNING paths.

- **Miscellaneous**
  - The driver relies on `rawsql-ts` result-select converters, so fixture definitions should include column types when you need precise casts or defaults.
  - Integration tests use `@testcontainers/postgresql`; ensure Docker is available when running `pnpm --filter @rawsql-ts/pg-testkit test`.
