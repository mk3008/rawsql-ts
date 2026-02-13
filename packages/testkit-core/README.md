# @rawsql-ts/testkit-core

![npm version](https://img.shields.io/npm/v/@rawsql-ts/testkit-core)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Pure TypeScript utilities for rewriting SELECT statements with fixture-backed CTEs, enabling deterministic unit tests without modifying original query structure.

## Features

- Validates fixture rows against declarative schemas (or registry lookups)
- Injects rewritten `WITH` clauses without touching the original query shape
- Supports fail-fast, passthrough, or warn-on-missing fixture strategies
- Supplies building blocks for driver adapters (see `@rawsql-ts/sqlite-testkit`, `@rawsql-ts/testkit-postgres`)

## Installation

```bash
npm install @rawsql-ts/testkit-core
```

## Quick Start

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

## Connection Strategy Provider

When your tests need to execute multiple repository calls, `createTestkitProvider` keeps a single backend connection open by default while isolating each scenario. The shared strategy wraps every call in a transaction so session state never leaks between fixtures.

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

The default configuration uses the `'shared'` strategy with `reset: 'transaction'` — `BEGIN` before each scenario and `ROLLBACK` afterward. For tests requiring persistent schema changes (temporary tables, `SET` commands, etc.), use `provider.perTest()` or pass `{ strategy: 'perTest' }` to create a new connection per run.

## License

MIT
