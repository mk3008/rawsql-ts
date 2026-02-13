# @rawsql-ts/testkit-postgres

![npm version](https://img.shields.io/npm/v/@rawsql-ts/testkit-postgres)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Postgres-specific fixture and rewriter logic that stays driver-agnostic. Rewritten SQL is a pure transformation — plug in any executor matching the `(sql, params) => Promise<Row[]>` contract.

## Features

- Postgres-specific CTE rewriting without bundling a SQL driver
- DDL-driven fixture loading with layered precedence
- Fixture validation against table definitions
- Works with any executor (pg, pg-promise, Drizzle, Prisma, etc.)

## Installation

```bash
npm install @rawsql-ts/testkit-postgres
```

## Quick Start

```ts
import path from 'node:path';
import { createPostgresTestkitClient, type QueryExecutor } from '@rawsql-ts/testkit-postgres';

const executor: QueryExecutor = async (sql, params) => {
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

const result = await client.query('SELECT id, email FROM users WHERE id = $1', [1]);
```

The package does not close connections or hold onto drivers — the executor you provide manages pooling and resources. For drop-in `pg` helpers (`createPgTestkitClient`, `createPgTestkitPool`, `wrapPgClient`), see `@rawsql-ts/adapter-node-pg`.

## Fixture Loading & Precedence

Fixtures combine in deterministic layers:

1. **DDL-driven fixtures** (`ddl.directories`) load first and populate schema metadata
2. **`tableDefinitions` / `tableRows`** passed to `createPostgresTestkitClient` override or augment the DDL metadata
3. **`client.withFixtures([...])`** layers scenario-specific rows on top before each query

DDL directories are read once at client creation, and every subsequent rewrite reuses that snapshot plus any in-memory overrides.

## QueryExecutor Contract

```ts
(sql: string, params: readonly unknown[]) => Promise<Record<string, unknown>[]>;
```

You can inspect or extend fixture metadata via `resolveFixtureState()` and `validateFixtureRowsAgainstTableDefinitions()`.

## License

MIT
