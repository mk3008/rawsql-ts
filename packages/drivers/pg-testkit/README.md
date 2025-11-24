# @rawsql-ts/pg-testkit

Postgres adapter utilities that let you exercise SQL-heavy repositories without provisioning physical tables. CRUD statements are rewritten into fixture-backed `WITH` queries and executed on a real `pg` connection so query plans, type casts, and parameter handling still round-trip through the database engine.

## Installation

```bash
npm install @rawsql-ts/pg-testkit
```

## `createPgTestkitClient`

Create an isolated client that lazily opens a `pg` connection and rewrites every incoming query. Fixtures supply both schema hints and inline rows used to shadow real tables.

```ts
import { Client } from 'pg';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';

const client = createPgTestkitClient({
  connectionFactory: () => new Client({ connectionString: process.env.PG_URL! }),
  fixtures: [
    {
      tableName: 'users',
      columns: [
        { name: 'id', typeName: 'int', required: true },
        { name: 'email', typeName: 'text' },
      ],
      rows: [{ id: 1, email: 'alice@example.com' }],
    },
  ],
});

const result = await client.query('select email from users where id = $1', [1]);
console.log(result.rows); // => [{ email: 'alice@example.com' }]
```

Use `client.withFixtures([...])` to derive a scoped view that layers scenario-specific fixtures on top of the base configuration.

## `wrapPgClient`

Wrap an existing `pg.Client`/`pg.Pool` instance so consumers can keep calling `.query` unchanged while fixtures inject CTEs under the hood.

```ts
import { Client } from 'pg';
import { wrapPgClient } from '@rawsql-ts/pg-testkit';

const raw = new Client({ connectionString: process.env.PG_URL! });
await raw.connect();

const wrapped = wrapPgClient(raw, {
  fixtures: [
    {
      tableName: 'orders',
      columns: [
        { name: 'id', typeName: 'int' },
        { name: 'total', typeName: 'numeric' },
      ],
      rows: [{ id: 42, total: 199.99 }],
    },
  ],
});

const rows = await wrapped.query('select id, total from orders where id = $1', [42]);
console.log(rows.rows); // => [{ id: 42, total: '199.99' }]
```

Call `wrapped.withFixtures([...])` to produce an isolated proxy that shadows different tables while reusing the same underlying connection.

## Notes

- DDL is ignored except for `CREATE TEMPORARY ... AS SELECT`, which is preserved so fixture-backed subqueries still hydrate temp tables when needed.
- `$1`-style parameters are normalized internally so parser limitations do not block rewrites; placeholders are restored before execution.
- The driver relies on `rawsql-ts` result-select converters, so fixture definitions should include column types when you need precise casts or defaults.
- Integration tests use `@testcontainers/postgresql`; ensure Docker is available when running `pnpm --filter @rawsql-ts/pg-testkit test`.
