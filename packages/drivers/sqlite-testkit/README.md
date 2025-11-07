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

const driver = createSqliteSelectTestDriver({
  connectionFactory: () => new Database(':memory:'),
  fixtures: [
    {
      tableName: 'users',
      rows: [{ id: 1, name: 'Alice', role: 'admin' }],
      schema: {
        columns: {
          id: 'INTEGER',
          name: 'TEXT',
          role: 'TEXT',
        },
      },
    },
  ],
  missingFixtureStrategy: 'error',
});

const rows = await driver.query('SELECT * FROM users');
```

Use `driver.withFixtures([...])` to derive a scoped driver with scenario-specific fixture overrides, and call `driver.close()` to dispose the underlying connection when the suite finishes.

## `wrapSqliteDriver`

Wrap an existing connection without changing downstream repository code:

```ts
import Database from 'better-sqlite3';
import { wrapSqliteDriver } from '@rawsql-ts/sqlite-testkit';

const raw = new Database(':memory:');
const intercepted = wrapSqliteDriver(raw, {
  fixtures: [
    { tableName: 'orders', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } },
  ],
  missingFixtureStrategy: 'warn',
});

intercepted.prepare('SELECT * FROM orders').all();
```

Call `intercepted.withFixtures([...])` to create an isolated proxy that applies additional fixtures on top of the base configuration.
