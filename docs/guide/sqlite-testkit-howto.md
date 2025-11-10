---
title: SQLite Testkit Guide
outline: deep
---

# Testing SQLite Repositories with `@rawsql-ts/sqlite-testkit`

This guide explains how to apply the `rawsql-ts` testing model using SQLite and `better-sqlite3`.

The `@rawsql-ts/sqlite-testkit` package rewrites `SELECT` statements into fixture-backed Common Table Expressions (CTEs), letting you assert SQL behavior without touching on-disk databases.

---

## Prerequisites

- Node.js 20+ and npm 10+  
- `better-sqlite3` installed  
- Vitest or Jest configured for TypeScript

Install the driver:

```bash
npm install --save-dev @rawsql-ts/sqlite-testkit
```

Optional demo dependencies are listed in `packages/drivers/sqlite-testkit/package.json`.

---

## Define a Schema Registry

Fixtures must know column names and affinities.  
Define them once per project:

```ts
// test/schema.ts
import type { SchemaRegistry, TableSchemaDefinition } from '@rawsql-ts/testkit-core';

const tables: Record<string, TableSchemaDefinition> = {
  customers: {
    columns: {
      id: 'INTEGER',
      email: 'TEXT',
      tier: 'TEXT',
      suspended_at: 'TEXT',
    },
  },
  customer_tiers: {
    columns: {
      tier: 'TEXT',
      monthly_quota: 'INTEGER',
      priority_level: 'TEXT',
    },
  },
};

export const schemaRegistry: SchemaRegistry = {
  getTable(name: string) {
    return tables[name.toLowerCase()];
  },
};
```

You can also define an inline schema directly inside a fixture for quick tests.

## Generating schema JSON from SQLite

Use the bundled CLI to inspect a SQLite database and emit a `schema.json` file automatically.
The command loads `better-sqlite3`, reads `sqlite_master`, and derives column affinities according to SQLite's published rules.
Invoke it from the workspace root so `ts-node` resolves the package-specific `tsconfig.json`.

```bash
pnpm --filter @rawsql-ts/sqlite-testkit run schema:generate -- \
  --database packages/drivers/sqlite-testkit/demo/sqlite/customer-demo.sqlite \
  --output packages/drivers/sqlite-testkit/demo/schema/schema.json
```

Add `--tables tableA,tableB` to limit the export to a subset of tables (name matching is case-insensitive). The CLI sorts tables alphabetically before writing and warns about any statements it cannot parse.

Ensure `better-sqlite3` is installed (it is an optional dependency for this CLI) before running the command.

### Per-table exports

You can pass `--per-table` to emit each table schema into its own JSON file inside the target directory (file names are URI-encoded to remain filesystem-safe). The demo registry now loads these fragments automatically when `schema.json` is missing, so you can keep one file per table and still share a `SchemaRegistry` instance.

---

## Option 1: In-Memory Driver (`createSqliteSelectTestDriver`)

For lightweight query assertions:

```ts
import Database from 'better-sqlite3';
import { createSqliteSelectTestDriver } from '@rawsql-ts/sqlite-testkit';
import { schemaRegistry } from './schema';

const driver = createSqliteSelectTestDriver({
  connectionFactory: () => new Database(':memory:'),
  fixtures: [
    {
      tableName: 'customers',
      rows: [{ id: 1, email: 'alice@example.com', tier: 'enterprise' }],
    },
  ],
  schema: schemaRegistry,
});

const rows = await driver.query(
  'SELECT * FROM customers WHERE tier = "enterprise"'
);

expect(rows).toEqual([{ id: 1, email: 'alice@example.com', tier: 'enterprise' }]);
driver.close();
```

Use `driver.withFixtures([...])` to layer temporary overrides for each test case.

---

## Option 2: Wrapping Repositories (`wrapSqliteDriver`)

Reuses existing repositories unchanged:

```ts
import Database from 'better-sqlite3';
import { wrapSqliteDriver } from '@rawsql-ts/sqlite-testkit';
import { CustomerRepository } from '../src/CustomerRepository';
import { schemaRegistry } from './schema';

const buildRepo = (fixtures: Record<string, any[]>) => {
  const proxy = wrapSqliteDriver(new Database(':memory:'), {
    fixtures: Object.entries(fixtures).map(([table, rows]) => ({ tableName: table, rows })),
    schema: schemaRegistry,
  });
  return new CustomerRepository(proxy);
};

const repo = buildRepo({
  customers: [{ id: 42, email: 'synthetic@example.com', tier: 'pro' }],
});

expect(repo.listActive()).toEqual([
  { id: 42, email: 'synthetic@example.com', displayName: 'Synthetic User', tier: 'pro' },
]);
repo.close();
```

---

## Debugging and Query Logs

Enable runtime inspection with:

```ts
const driver = wrapSqliteDriver(new Database(':memory:'), {
  fixtures: [{ tableName: 'orders', rows: [{ id: 1 }] }],
  schema: schemaRegistry,
  onExecute(sql) {
    console.log('[SQL]', sql);
  },
  recordQueries: true,
});
```

`driver.queries` keeps a full log for assertions.

---

## Running Tests

```bash
pnpm vitest --config packages/drivers/sqlite-testkit/vitest.config.ts
```

If `better-sqlite3` fails to compile in CI, prebuild it with:

```bash
node packages/drivers/sqlite-testkit/scripts/install-better-sqlite3.cjs
```

---

## Troubleshooting

- **Missing schema:** Ensure every fixture table is registered or includes an inline schema.  
- **No test files:** Update `vitest.workspace.ts` include patterns.  
- **Leaked handles:** Always close the driver at the end of each test.  
- **Fixtures not applied:** Only `SELECT` statements are intercepted - DMLs pass through unchanged.

---

With these tools, you can reuse production repositories unchanged while gaining hermetic, deterministic SQL unit tests.

## Learn More

- [Testkit Concept](./testkit-concept.md) - Understand the rationale behind fixture-driven SQL unit testing.
- [SchemaRegistry API](../api/interfaces/SchemaRegistry.md) - Reference the type contracts for schema lookups and inline overrides.
- [SelectQueryParser](../api/classes/SelectQueryParser.md) - See how the parser exposes AST nodes for fixture injection and diagnostics.

## Next Steps

- Run the demo specs under `packages/drivers/sqlite-testkit/tests` to validate your setup end-to-end.
- Port existing repository tests by wrapping your `better-sqlite3` adapter as shown in `packages/drivers/sqlite-testkit/demo/tests/customer-intercept.test.ts`.

