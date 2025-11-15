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

## DAL 1.0 CUD pipeline coverage

`testkit-core` now ships with CUD helpers and the `TestkitDbAdapter` that rewrite `INSERT` statements into `INSERT ... SELECT` flows, apply casts, and run shape/runtime validation purely against in-memory `TableDef` snapshots. The adapter never queries `information_schema` or any live tables—every schema lookup comes from the declarative `TableDef` provided by the test.  

Integration tests under `packages/testkit-core/tests/cud/` explicitly cover the adapter pipeline, ensuring VALUES normalisation, type casts, and DTO FROM validation work before any downstream driver executes SQL. This keeps the Postgres/SQLite driver tests free of real schema dependencies while matching the DataAccessLayer 1.0 policy.
