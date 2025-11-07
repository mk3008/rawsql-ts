---
title: SQLite Testkit Guide
outline: deep
---

# Testing SQLite Repositories with `@rawsql-ts/sqlite-testkit`

This guide shows how to run fast, deterministic unit tests for any repository or data-access layer that talks to `better-sqlite3`. The `@rawsql-ts/sqlite-testkit` package rewrites `SELECT` statements into fixture-backed Common Table Expressions (CTEs), so you can assert against realistic rows without mutating on-disk databases. Under the hood, every intercepted `SELECT` becomes a `WITH <table> AS (SELECT … UNION ALL …)` style block, so tests execute against temporary in-memory tables rather than the physical database file.

## Prerequisites

- Node.js 20+ and npm 10+ (matches the workspace baseline).
- `better-sqlite3` installed as a dependency or devDependency.
- Vitest (or your preferred runner) configured for TypeScript projects.

Install the driver package:

```bash
npm install --save-dev @rawsql-ts/sqlite-testkit
```

If you plan to run the demo repository locally, also install the optional dependencies listed in `packages/drivers/sqlite-testkit/package.json`.

## Define a Schema Registry Once

Fixtures need to know the column names and affinities for each table they shadow. Instead of duplicating schema definitions inside every fixture, register them centrally and pass the registry to all helpers:

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

Passing `schema: schemaRegistry` guarantees every fixture row is validated before execution. For quick experiments or tables that are not yet in the registry, you can still attach an inline schema directly to the fixture:

```ts
fixtures: [
  {
    tableName: 'customers',
    rows: [{ id: 1, email: 'a@example.com', tier: 'basic' }],
    schema: {
      columns: { id: 'INTEGER', email: 'TEXT', tier: 'TEXT' },
    },
  },
];
```

## Option 1: In-Memory Tests via `createSqliteSelectTestDriver`

Use the select driver when you only need to assert raw result sets rather than exercise the entire repository surface:

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createSqliteSelectTestDriver } from '@rawsql-ts/sqlite-testkit';
import { schemaRegistry } from './schema';

const connectionFactory = () => new Database(':memory:');

describe('reporting queries', () => {
  it('projects enterprise customers', async () => {
    const driver = createSqliteSelectTestDriver({
      connectionFactory,
      fixtures: [
        {
          tableName: 'customers',
          rows: [{ id: 1, email: 'alice@example.com', tier: 'enterprise', suspended_at: null }],
        },
      ],
      schema: schemaRegistry,
      missingFixtureStrategy: 'error',
    });

    const rows = await driver.query('SELECT * FROM customers WHERE tier = "enterprise"');

    expect(rows).toEqual([
      { id: 1, email: 'alice@example.com', tier: 'enterprise', suspended_at: null },
    ]);

    driver.close();
  });
});
```

Call `driver.withFixtures([...])` inside a test to derive a scoped driver that layers scenario-specific fixtures on top of the base set.

Need to exercise multiple tables at once? Provide all relevant fixtures up front and assert against joins or correlated subqueries just like production code:

```ts
it('joins customers with their tier metadata', async () => {
  const driver = createSqliteSelectTestDriver({
    connectionFactory,
    fixtures: [
      {
        tableName: 'customers',
        rows: [{ id: 1, email: 'alice@example.com', tier: 'enterprise', suspended_at: null }],
      },
      {
        tableName: 'customer_tiers',
        rows: [
          { tier: 'enterprise', monthly_quota: 1000, priority_level: 'gold', escalation_sla_hours: 1 },
        ],
      },
    ],
    schema: schemaRegistry,
  });

  const rows = await driver.query(`
    SELECT c.email, t.priority_level
    FROM customers c
    JOIN customer_tiers t ON t.tier = c.tier
    WHERE t.priority_level = 'gold'
  `);

  expect(rows).toEqual([{ email: 'alice@example.com', priority_level: 'gold' }]);

  driver.close();
});
```

## Option 2: Wrap Repositories Without Modifying Their Code

When you want to reuse production repositories without touching their code paths, wrap the `better-sqlite3` connection and inject the proxy:

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { wrapSqliteDriver } from '@rawsql-ts/sqlite-testkit';
import { CustomerRepository } from '../src/CustomerRepository';
import { schemaRegistry } from './schema';

const baseConnection = () => new Database(':memory:');

const buildRepository = (fixtures: Record<string, Array<Record<string, unknown>>>) => {
  const proxy = wrapSqliteDriver(baseConnection(), {
    fixtures: Object.entries(fixtures).map(([tableName, rows]) => ({ tableName, rows })),
    schema: schemaRegistry,
    missingFixtureStrategy: 'error',
  });
  return new CustomerRepository(proxy);
};

describe('CustomerRepository interception', () => {
  it('returns fixture rows for listActive', () => {
    const repo = buildRepository({
      customers: [
        { id: 42, email: 'synthetic@example.com', tier: 'pro', suspended_at: null },
      ],
    });

    expect(repo.listActive()).toEqual([
      {
        id: 42,
        email: 'synthetic@example.com',
        displayName: 'Synthetic User',
        tier: 'pro',
        suspendedAt: null,
      },
    ]);

    repo.close();
  });
});
```

The proxy intercepts `prepare`, `exec`, `all`, `get`, and `run`. Any `SELECT` statement is rewritten into a CTE fed by the provided fixtures, while non-`SELECT` calls fall back to the underlying connection untouched.

### Debugging Generated SQL

`wrapSqliteDriver` exposes two options that help inspect the final SQL after fixture injection:

- `onExecute(sql, params)` is invoked whenever the proxy calls `exec`, `all`, `get`, or `run`.
- `recordQueries: true` enables an in-memory log accessible via `proxy.queries`.

```ts
const intercepted = wrapSqliteDriver(baseConnection(), {
  fixtures: [{ tableName: 'orders', rows: [{ id: 1 }] }],
  schema: schemaRegistry,
  onExecute(sql, params) {
    console.log('[sql]', sql, params);
  },
  recordQueries: true,
});

intercepted.exec?.('SELECT * FROM orders');
console.log(intercepted.queries);
// [
//   {
//     method: 'exec',
//     sql: `WITH "orders" AS (
//             SELECT 1 AS "id"
//           )
//           SELECT * FROM orders`,
//     params: undefined,
//   },
// ]
```

### Isolated Fixture Overrides

Call `intercepted.withFixtures([...])` to clone the proxy with additional fixtures. Each derived proxy tracks its own query log when `recordQueries` is enabled, so parallel tests remain isolated.

## Running the Tests

Add the new suite to a workspace-wide Vitest config (for example, by including `packages/drivers/sqlite-testkit/tests/**/*.test.ts`). You can also run the package-specific config directly:

```bash
pnpm vitest --config packages/drivers/sqlite-testkit/vitest.config.ts
```

If your CI environment lacks the native `better-sqlite3` binary, run `node packages/drivers/sqlite-testkit/scripts/install-better-sqlite3.cjs` during setup to compile it ahead of time.

## Troubleshooting Checklist

- **Missing schema errors**: ensure every fixture table is registered or carries an inline `schema`.
- **No test files found**: update `vitest.workspace.ts` or the relevant config `include` glob to cover the new package.
- **Stale connections**: call `repo.close()` or `driver.close()` at the end of each test to release file handles, especially on Windows.
- **Fixtures not applied?** Make sure the query starts with `SELECT`—non-`SELECT` statements (such as `UPDATE` or `INSERT`) are passed straight through to the underlying driver.

With these building blocks, you can keep repositories identical to production while still writing hermetic unit tests that assert on deterministic fixture data.
