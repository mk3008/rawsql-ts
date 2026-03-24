# @rawsql-ts/testkit-postgres

![npm version](https://img.shields.io/npm/v/@rawsql-ts/testkit-postgres)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Postgres-specific fixture and rewriter logic that stays driver-agnostic. Rewritten SQL is a pure transformation — plug in any executor matching the `(sql, params) => Promise<Row[]>` contract.

## Features

- Postgres-specific CTE rewriting without bundling a SQL driver
- Generated fixture manifests first, with DDL-driven fallback for bootstrap or legacy layouts
- Fixture validation against table definitions
- Works with any executor (pg, pg-promise, Drizzle, Prisma, etc.)

## Installation

```bash
npm install @rawsql-ts/testkit-postgres
```

## Quick Start

```ts
import { createPostgresTestkitClient, type QueryExecutor } from '@rawsql-ts/testkit-postgres';
import { generatedFixtureManifest } from './tests/generated/ztd-fixture-manifest.generated.js';

const executor: QueryExecutor = async (sql, params) => {
  return [{ id: 1, email: 'alice@example.com' }];
};

const client = createPostgresTestkitClient({
  queryExecutor: executor,
  generated: generatedFixtureManifest,
});

const result = await client.query('SELECT id, email FROM users WHERE id = $1', [1]);
```

The package does not close connections or hold onto drivers — the executor you provide manages pooling and resources. For drop-in `pg` helpers (`createPgTestkitClient`, `createPgTestkitPool`, `wrapPgClient`), see `@rawsql-ts/adapter-node-pg`.

> **Note:** Transaction commands (`BEGIN` / `COMMIT` / `ROLLBACK`) used within testkit are for **test isolation only**. In production code, transaction boundaries and connection lifecycle are the caller's responsibility — not a concern of the query catalog or fixture layer. See the [Execution Scope guide](../../docs/guide/execution-scope.md) for details.

## Fixture Loading & Precedence

Fixtures combine in deterministic layers:

1. **Generated fixture manifests** from `ztd-config` populate schema metadata first
2. **`tableDefinitions` / `tableRows`** passed to `createPostgresTestkitClient` override or augment the generated metadata
3. **`client.withFixtures([...])`** layers scenario-specific rows on top before each query
4. **`ddl.directories`** remains available as a legacy fallback when no generated manifest is supplied

DDL directories are only scanned when no generated manifest is supplied. In the normal path, `createPostgresTestkitClient` uses generated metadata directly and skips raw DDL scanning altogether.

## QueryExecutor Contract

```ts
(sql: string, params: readonly unknown[]) => Promise<Record<string, unknown>[]>;
```

You can inspect or extend fixture metadata via `resolveFixtureState()` and `validateFixtureRowsAgainstTableDefinitions()`.

## License

MIT
