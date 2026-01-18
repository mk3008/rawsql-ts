# @rawsql-ts/testkit-postgres

`@rawsql-ts/testkit-postgres` contains the Postgres-specific rewrite and fixture helpers without bundling a SQL driver. It treats rewritten SQL as a pure transformation and lets you plug in any executor that satisfies the `(sql, params) => Promise<Row[]>` contract.

## Installation

```bash
pnpm add -D @rawsql-ts/testkit-postgres
```

## Creating a Postgres testkit client

```ts
import path from 'node:path';
import { createPostgresTestkitClient, type QueryExecutor } from '@rawsql-ts/testkit-postgres';

const executor: QueryExecutor = async (sql, params) => {
  // Delegate to your preferred driver/pool and return the rows directly.
  return [{ id: 1, email: 'alice@example.com' }];
};

const client = createPostgresTestkitClient({
  queryExecutor: executor,
  tableDefinitions: [
    {
      name: 'users',
      columns: [
        { name: 'id', typeName: 'int', required: true },
        { name: 'email', typeName: 'text', required: true },
      ],
    },
  ],
  ddl: { directories: [path.join('ztd', 'ddl')] },
});

const result = await client.query('select id, email from users where id = $1', [1]);
console.log(result.rows); // => [{ id: 1, email: 'alice@example.com' }]
```

The package does not close connections or hold onto drivers; the executor you provide manages opening, pooling, and releasing resources. When you need drop-in shorthand helpers (`createPgTestkitClient`, `createPgTestkitPool`, `wrapPgClient`), install the companion `@rawsql-ts/adapter-node-pg` package that wires this core to Node’s `pg` module.

## QueryExecutor contract

```ts
(sql: string, params: readonly unknown[]) => Promise<Record<string, unknown>[]>;
```

Every rewrite runs through `ResultSelectRewriter`, `DefaultFixtureProvider`, and `TableNameResolver`. You can inspect or extend the fixture metadata via:

- `resolveFixtureState(options, tableNameResolver)` — merges DDL fixtures, explicit definitions, and user rows.
- `validateFixtureRowsAgainstTableDefinitions(...)` — ensures every fixture column/table is defined.

## Fixture loading & precedence

Fixtures combine in deterministic layers:

1. DDL-driven fixtures (`ddl.directories`) load first and populate schema metadata.
2. `tableDefinitions` and `tableRows` passed to `createPostgresTestkitClient` override/augment the DDL metadata.
3. `client.withFixtures([...])` layers scenario-specific rows on top before each query.

DDL directories are read once when you create the client, and every subsequent rewrite reuses that snapshot plus any in-memory overrides.

## Testing

Run `pnpm --filter @rawsql-ts/testkit-postgres test` to exercise the driver-agnostic unit tests that validate fixture validation, diagnostics, and executor wiring without depending on Docker or a running Postgres instance.
