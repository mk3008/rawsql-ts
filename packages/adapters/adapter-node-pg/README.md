# @rawsql-ts/adapter-node-pg

![npm version](https://img.shields.io/npm/v/@rawsql-ts/adapter-node-pg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Testkit adapter connecting `pg` (node-postgres) Client/Pool APIs to `@rawsql-ts/testkit-postgres`.
It is for fixture-backed ZTD tests, not the production SQL driver adapter layer.
All rewriting and fixture logic is delegated to `@rawsql-ts/testkit-postgres`.

The current package name is retained for existing users.
The intended future naming direction is a non-breaking alias such as `@rawsql-ts/testkit-adapter-node-postgres`, with `@rawsql-ts/adapter-node-pg` kept as the compatible legacy surface during migration.

## Features

- Drop-in testkit helpers for `pg.Client` and `pg.Pool`
- Named parameter support for test fixtures (`:user_id` compiled to `$1`)
- Reuses fixture validation and schema snapshot from `@rawsql-ts/testkit-postgres`

## Installation

```bash
npm install @rawsql-ts/adapter-node-pg pg
```

`@rawsql-ts/testkit-postgres` is installed automatically as a dependency.

For production runtime SQL execution, use the `driver-adapter-*` package space such as `@rawsql-ts/driver-adapter-core`.
This package intentionally stays in the testkit adapter role so a future production `@rawsql-ts/driver-adapter-node-postgres` package can coexist without name confusion.

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

## Package Naming

`@rawsql-ts/adapter-node-pg` is a testkit adapter package.
It adapts node-postgres to the ZTD/testkit fixture rewriting path.

The production driver adapter package space is separate:

- `driver-adapter-*` packages are for production SQL driver mechanics such as named-parameter compilation, placeholder conversion, and row-result normalization.
- `testkit-adapter-*` packages are for ZTD/testkit fixture rewriting adapters that connect concrete drivers to `@rawsql-ts/testkit-*`.

The preferred future name for this package is `@rawsql-ts/testkit-adapter-node-postgres`.
That rename should be introduced through a non-breaking alias package before this legacy name is deprecated in docs or package metadata.

## License

MIT
