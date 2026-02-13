# @rawsql-ts/adapter-node-pg

![npm version](https://img.shields.io/npm/v/@rawsql-ts/adapter-node-pg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Adapter connecting `pg` (node-postgres) Client/Pool APIs to `@rawsql-ts/testkit-postgres`. All rewriting and fixture logic is delegated to the driver-agnostic package.

## Features

- Drop-in helpers for `pg.Client` and `pg.Pool`
- Named parameter support (`:user_id` compiled to `$1`)
- Reuses fixture validation and schema snapshot from `@rawsql-ts/testkit-postgres`

## Installation

```bash
npm install @rawsql-ts/adapter-node-pg pg
```

`@rawsql-ts/testkit-postgres` is installed automatically as a dependency.

## Quick Start

```ts
import { createPgTestkitClient } from '@rawsql-ts/adapter-node-pg';

const client = createPgTestkitClient({
  connectionFactory: () => pool.connect(),
  tableDefinitions: [
    {
      name: 'users',
      columns: [
        { name: 'id', typeName: 'int', required: true },
        { name: 'email', typeName: 'text', required: true },
      ],
    },
  ],
  tableRows: [
    { tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] },
  ],
});

const result = await client.query('SELECT id, email FROM users WHERE id = $1', [1]);
```

## API

| Function | Description |
|----------|-------------|
| `createPgTestkitClient(options)` | Creates a `PgTestkitClient` that lazily opens a `pg` connection and rewrites queries using fixtures. |
| `createPgTestkitPool(connectionString, ...fixtures)` | Builds a `pg.Pool` whose client constructor is replaced with `PgTestkitClient`. |
| `wrapPgClient(client, options)` | Wraps an existing `pg.Client` or `pg.Pool` so queries flow through fixtures without touching your schema. |

All helpers accept the same fixture configuration (`tableDefinitions`, `tableRows`, `ddl`, `missingFixtureStrategy`, etc.) and pass `onExecute` hooks through to `@rawsql-ts/testkit-postgres`.

## License

MIT
