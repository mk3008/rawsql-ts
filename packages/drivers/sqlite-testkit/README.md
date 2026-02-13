# @rawsql-ts/sqlite-testkit

![npm version](https://img.shields.io/npm/v/@rawsql-ts/sqlite-testkit)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

SQLite driver adapter for running repository tests entirely in-memory by shadowing tables with fixture-backed CTEs. Built on `@rawsql-ts/testkit-core` for schema validation and SQL rewrites.

## Features

- In-memory testing with `better-sqlite3`
- Transparent query interception via `wrapSqliteDriver`
- Scenario-specific fixture overrides with `withFixtures`
- Schema registry support for consistent large test suites

## Installation

```bash
npm install @rawsql-ts/sqlite-testkit
```

## Quick Start

```ts
import Database from 'better-sqlite3';
import { createSqliteSelectTestDriver } from '@rawsql-ts/sqlite-testkit';

const driver = createSqliteSelectTestDriver({
  connectionFactory: () => new Database(':memory:'),
  fixtures: [
    {
      tableName: 'users',
      rows: [{ id: 1, name: 'Alice', role: 'admin' }],
      schema: { columns: { id: 'INTEGER', name: 'TEXT', role: 'TEXT' } },
    },
  ],
  missingFixtureStrategy: 'error',
});

const rows = await driver.query('SELECT * FROM users');
```

Use `driver.withFixtures([...])` to derive a scoped driver with scenario-specific overrides, and `driver.close()` to dispose the connection when done.

## Wrapping an Existing Connection

`wrapSqliteDriver` turns any `better-sqlite3` connection into a transparent proxy that intercepts `prepare`, `exec`, `all`, `get`, and `run` — rewriting SELECT statements into fixture-backed CTEs while passing through everything else.

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
});

intercepted.prepare('SELECT * FROM orders').all();
console.log(intercepted.queries); // inspect emitted SQL
```

## License

MIT
