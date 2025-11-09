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
