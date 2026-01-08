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

## Connection strategy provider

When your tests need to execute multiple repository calls, `createTestkitProvider`
lets you keep a single backend connection open by default while still isolating
each scenario. The shared strategy wraps every call in a transaction so the
session state never leaks between fixtures.

```ts
import { createTestkitProvider } from '@rawsql-ts/testkit-core';

const provider = await createTestkitProvider({
  connectionFactory: async () => pool.connect(),
  resourceFactory: async (connection, fixtures) =>
    createPgTestkitClient({
      connectionFactory: () => connection,
      tableRows: fixtures,
    }),
});

await provider.withRepositoryFixture(fixtures, async (client) => {
  await client.query('SELECT COUNT(*) FROM public.users');
});

await provider.close();
```

The default configuration uses the `'shared'` strategy plus `reset: 'transaction'`,
which executes `BEGIN` before each scenario and `ROLLBACK` afterward. If you do
need to keep persistent schema changes (temporary tables, `SET` commands, etc.)
for a specific test, call `provider.perTest()` or pass `{ strategy: 'perTest' }`
to `withRepositoryFixture` so a brand-new connection is created just for that run.
You can also override `reset` with `'none'` or a custom hook when you need to
apply bespoke cleanup logic between shared scenarios.
