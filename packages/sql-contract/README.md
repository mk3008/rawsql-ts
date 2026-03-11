# @rawsql-ts/sql-contract

![npm version](https://img.shields.io/npm/v/@rawsql-ts/sql-contract)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A lightweight library for mapping SQL query results into typed application models. It removes the repetitive, mechanical code around handwritten SQL while keeping SQL as the authoritative source for domain logic.

Inspired by minimal mapping libraries such as Dapper — stopping short of a full ORM and instead providing a predictable, transparent layer.

## Features

- Zero runtime dependencies
- Works with any SQL executor returning rows (driver/DBMS agnostic)
- Automatic snake_case to camelCase column name conversion
- Single and multi-model mapping with `rowMapping`
- Validator-agnostic schema integration (Zod, ArkType, or any `parse`/`assert` compatible library)
- Scalar query helpers for COUNT / aggregate values

## Installation

```bash
npm install @rawsql-ts/sql-contract
```

## Quick Start

```ts
import { createReader, type QueryParams } from '@rawsql-ts/sql-contract'

const executor = async (sql: string, params: QueryParams) => {
  const result = await pool.query(sql, params as unknown[])
  return result.rows
}

const reader = createReader(executor)

const customers = await reader.list(
  'SELECT customer_id, customer_name FROM customers WHERE status = $1',
  ['active']
)
// [{ customerId: 1, customerName: 'Alice' }, ...]
```

## Reader API

### Basic queries: `one` and `list`

```ts
const customer = await reader.one(
  'SELECT customer_id, customer_name FROM customers WHERE customer_id = $1',
  [1]
)

const customers = await reader.list(
  'SELECT customer_id, customer_name FROM customers'
)
```

### Column naming conventions

By default, Reader converts snake_case columns to camelCase properties automatically:

```sql
SELECT customer_id, created_at FROM customers
```

becomes:

```ts
{ customerId: number, createdAt: Date }
```

Presets are available to change this behavior:

```ts
import { mapperPresets } from '@rawsql-ts/sql-contract'

const reader = createReader(executor, mapperPresets.safe())  // no transformation
```

### Custom mapping

For derived values or format conversion:

```ts
const rows = await reader.map(
  'SELECT price, quantity FROM order_items',
  (row) => ({ total: row.price * row.quantity })
)
```

### Row mapping with `rowMapping`

For reusable, explicit mappings where domain terms differ from column names:

```ts
import { rowMapping } from '@rawsql-ts/sql-contract'

const orderSummaryMapping = rowMapping({
  name: 'OrderSummary',
  key: 'orderId',
  columnMap: {
    orderId: 'order_id',
    customerLabel: 'customer_display_name',
    totalAmount: 'grand_total',
  },
})

const summaries = await reader
  .bind(orderSummaryMapping)
  .list('SELECT order_id, customer_display_name, grand_total FROM order_view')
```

Keys can be composite (`key: ['col_a', 'col_b']`) or derived (`key: (row) => [row.col_a, row.col_b]`).

### Multi-model mapping

Map joined results into nested domain models with `belongsTo`:

```ts
const customerMapping = rowMapping({
  name: 'Customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_customer_id',
    customerName: 'customer_customer_name',
  },
})

const orderMapping = rowMapping({
  name: 'Order',
  key: 'orderId',
  columnMap: {
    orderId: 'order_order_id',
    orderTotal: 'order_total',
    customerId: 'order_customer_id',
  },
}).belongsTo('customer', customerMapping, 'customerId')

const orders = await reader.bind(orderMapping).list(`
  SELECT
    c.id AS customer_customer_id,
    c.name AS customer_customer_name,
    o.id AS order_order_id,
    o.total AS order_total,
    o.customer_id AS order_customer_id
  FROM customers c
  JOIN orders o ON o.customer_id = c.customer_id
`)
// [{ orderId: 1, orderTotal: 500, customerId: 3, customer: { customerId: 3, customerName: 'Alice' } }]
```

### Scalar queries

```ts
const count = await reader.scalar(
  'SELECT count(*) FROM customers WHERE status = $1',
  ['active']
)
```

## Validation Integration

The `.validator()` method accepts any object implementing `parse(value)` or `assert(value)`. This means **Zod**, **ArkType**, and other validation libraries work out of the box — no additional adapter packages required.

### With Zod

```ts
import { z } from 'zod'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
})

const customers = await reader
  .validator(CustomerSchema)
  .list('SELECT customer_id, customer_name FROM customers')
```

### With ArkType

```ts
import { type } from 'arktype'

const CustomerSchema = type({
  customerId: 'number',
  customerName: 'string',
})

const customers = await reader
  .validator((value) => {
    CustomerSchema.assert(value)
    return value
  })
  .list('SELECT customer_id, customer_name FROM customers')
```

Validators run after row mapping, so schema errors surface before application code relies on the result shape. Validators are also chainable: `.validator(v1).validator(v2)`.

## Catalog Executor

For larger projects, `createCatalogExecutor` executes queries through a `QuerySpec` contract instead of raw SQL strings. A `QuerySpec` couples an SQL file, parameter shape, and output rules into a stable identity for debugging and observability.

### QuerySpec

A `QuerySpec` is the core contract type:

```ts
import type { QuerySpec } from '@rawsql-ts/sql-contract'
import { rowMapping } from '@rawsql-ts/sql-contract'

const activeCustomersSpec: QuerySpec<[], { customerId: number; customerName: string }> = {
  id: 'customers.active',
  sqlFile: 'customers/active.sql',
  params: { shape: 'positional', example: [] },
  metadata: {
    material: ['active_customer_ids'],
    scalarMaterial: ['active_customer_count'],
  },
  output: {
    mapping: rowMapping({
      name: 'Customer',
      key: 'customerId',
      columnMap: {
        customerId: 'customer_id',
        customerName: 'customer_name',
      },
    }),
    example: { customerId: 1, customerName: 'Alice' },
  },
  tags: { domain: 'crm' },
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for debugging and observability |
| `sqlFile` | Path passed to the SQL loader |
| `params.shape` | `'positional'` (array) or `'named'` (record) |
| `params.example` | Example parameters (for documentation and testing) |
| `output.mapping` | Optional `rowMapping` applied before validation |
| `output.validate` | Optional function to validate/transform each row |
| `output.example` | Example output (for documentation and testing) |
| `notes` | Optional human-readable description |
| `tags` | Optional key-value metadata forwarded to observability events |
| `metadata.material` | Optional CTE names to materialize as temp tables at runtime |
| `metadata.scalarMaterial` | Optional CTE names to treat as scalar materializations at runtime |

### QuerySpec metadata

Use `metadata` when runtime adapters need execution hints without changing the SQL asset itself:

```ts
const monthlyReportSpec: QuerySpec<{ tenantId: string }, { value: number }> = {
  id: 'reports.monthly',
  sqlFile: 'reports/monthly.sql',
  params: {
    shape: 'named',
    example: { tenantId: 'tenant-1' },
  },
  metadata: {
    material: ['report_base'],
    scalarMaterial: ['report_total'],
  },
  output: {
    example: { value: 1 },
  },
}
```

The metadata remains available on `spec.metadata` inside rewriters and is also forwarded to runtime extensions through `ExecInput.metadata`.

### Creating a CatalogExecutor

```ts
import { createCatalogExecutor } from '@rawsql-ts/sql-contract'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function createFileSqlLoader(baseDir: string) {
  return {
    load(sqlFile: string) {
      return readFile(resolve(baseDir, sqlFile), 'utf-8')
    },
  }
}

const catalog = createCatalogExecutor({
  loader: createFileSqlLoader('sql'),
  executor,
})
```

The executor exposes three methods matching the Reader API:

```ts
const customers = await catalog.list(activeCustomersSpec, [])
const customer  = await catalog.one(customerByIdSpec, [42])
const count     = await catalog.scalar(customerCountSpec, [])
```

For larger applications, keeping the file-backed loader in one helper avoids
repeating the same `readFile(resolve(...))` wiring in every repository module.

### Common catalog output patterns

The output pipeline for `list()` / `one()` is:

1. raw SQL row
2. `output.mapping` (optional)
3. `output.validate` (optional)

That means validators should read the mapped DTO shape, not the raw SQL row.

For scalar queries, the pipeline is:

1. raw SQL row
2. single-column scalar extraction
3. `output.validate` (optional)

That makes `count(*)` and `RETURNING id` contracts read more clearly when they
validate the extracted scalar directly instead of inventing a one-field DTO.

See [docs/recipes/sql-contract.md](../../docs/recipes/sql-contract.md) for
copy-paste-ready catalog examples covering:

- reusable file-backed loaders
- mapped DTO validation
- scalar contract patterns

### Named parameters

Specs declaring `shape: 'named'` require either a `Binder` or an explicit opt-in:

```ts
const catalog = createCatalogExecutor({
  loader,
  executor,
  // Option A: provide a binder that converts named → positional
  binders: [{
    name: 'pg-named',
    bind: ({ sql, params }) => {
      // convert :name placeholders to $1, $2, ...
      return { sql: boundSql, params: positionalArray }
    },
  }],
  // Option B: pass named params directly to the executor
  // allowNamedParamsWithoutBinder: true,
})
```

### Mutation specs

Catalog specs can declare mutation metadata for `INSERT`, `UPDATE`, and `DELETE` assets:

```ts
const createUserSpec: QuerySpec<
  { id: string; display_name?: string | null; created_at?: string },
  never
> = {
  id: 'user.create',
  sqlFile: 'user/create.sql',
  params: {
    shape: 'named',
    example: {
      id: 'user-1',
      display_name: 'Alice',
      created_at: '2026-03-05T00:00:00.000Z',
    },
  },
  mutation: {
    kind: 'insert',
  },
  output: {
    example: undefined as never,
  },
}
```

The `insert` behavior is covered by `packages/sql-contract/tests/catalog.create.test.ts`.

```ts
const updateUserSpec: QuerySpec<
  { id: string; display_name?: string | null; bio?: string | null },
  never
> = {
  id: 'user.update-profile',
  sqlFile: 'user/update-profile.sql',
  params: {
    shape: 'named',
    example: { id: 'user-1', display_name: 'Alice', bio: null },
  },
  mutation: {
    kind: 'update',
  },
  output: {
    example: undefined as never,
  },
}
```

Phase 1 intentionally keeps the safety rules narrow:

- `INSERT` subtracts only direct `VALUES (:named_param)` entries when the key is missing or `undefined`.
- `UPDATE` and `DELETE` require a `WHERE` clause by default.
- `UPDATE` subtracts only simple `SET column = :param` assignments when the key is missing or `undefined`.
- `null` is preserved, so `SET column = :param` still executes and binds `NULL`.
- Mandatory parameter validation only inspects the `WHERE` clause because Phase 1 focuses on preventing accidental broad mutations first.

For example, the SQL asset below will drop `display_name = :display_name` when
`display_name` is omitted or `undefined`, but it keeps the fixed timestamp write:

```sql
UPDATE public.user_account
SET display_name = :display_name,
    bio = :bio,
    updated_at = NOW()
WHERE id = :id
```

Assignments with inline comments or more complex expressions stay untouched in
Phase 1. They remain visible in SQL and any unresolved placeholders still flow
through the configured binder/executor path.

### Rewriters

Rewriters apply semantic-preserving SQL transformations before execution:

```ts
const catalog = createCatalogExecutor({
  loader,
  executor,
  rewriters: [{
    name: 'add-limit',
    rewrite: ({ sql, params }) => ({
      sql: `${sql} LIMIT 1000`,
      params,
    }),
  }],
})
```

The execution pipeline order is: **SQL load → rewriters → binders → executor**.

Mutation specs apply one extra safety rule in Phase 1: every configured
rewriter must explicitly declare `mutationSafety: 'safe'`. This keeps mutation
preprocessing stable by rejecting rewriters that might alter `SET` or `WHERE`
structure.

```ts
const auditCommentRewriter: Rewriter & { mutationSafety: 'safe' } = {
  name: 'audit-comment',
  mutationSafety: 'safe',
  rewrite: ({ sql, params }) => ({
    sql: `${sql} -- audit`,
    params,
  }),
}
```

Rewriters without that explicit marker still work for non-mutation specs.

### DELETE guards and `rowCount`

Physical deletes default to an affected-row guard of `exactly 1`. To evaluate
that guard safely, the configured executor must expose `rowCount` via
`{ rows, rowCount }` results.

```ts
const executor = async (sql: string, params: QueryParams) => {
  const result = await client.query(sql, params as unknown[])
  return {
    rows: result.rows,
    rowCount: result.rowCount,
  }
}
```

If the executor does not expose `rowCount`, delete specs fail by default. You
may opt out per spec only when you intentionally want no guard:

```ts
mutation: {
  kind: 'delete',
  delete: {
    affectedRowsGuard: { mode: 'none' },
  },
}
```

For fixture-backed tests, `@rawsql-ts/testkit-core` provides `createCatalogRewriter()` so you can plug `SelectFixtureRewriter` into the catalog pipeline without writing an adapter:

```ts
import { createCatalogExecutor } from '@rawsql-ts/sql-contract'
import { createCatalogRewriter } from '@rawsql-ts/testkit-core'

const catalog = createCatalogExecutor({
  loader,
  executor,
  rewriters: [createCatalogRewriter({
    fixtures: [{
      tableName: 'users',
      rows: [{ id: 1, name: 'Alice' }],
      schema: {
        columns: {
          id: 'INTEGER',
          name: 'TEXT',
        },
      },
    }],
  })],
})
```

### Observability

When an `observabilitySink` is provided, the executor emits lifecycle events:

```ts
const catalog = createCatalogExecutor({
  loader,
  executor,
  observabilitySink: {
    emit(event) {
      // event.kind: 'query_start' | 'query_end' | 'query_error'
      // event.specId, event.sqlFile, event.execId, event.durationMs, ...
      console.log(`[${event.kind}] ${event.specId}`)
    },
  },
})
```

### Error handling

Catalog errors form a hierarchy rooted at `CatalogError`:

| Error class | Cause |
|-------------|-------|
| `SQLLoaderError` | SQL file could not be loaded |
| `RewriterError` | A rewriter threw during transformation |
| `BinderError` | A binder failed or returned invalid output |
| `ContractViolationError` | Parameter shape mismatch, unexpected row count, etc. |
| `CatalogExecutionError` | The underlying query executor failed |

All error classes expose `specId` and `cause` properties for structured logging.

## Execution Scope and Transaction Boundaries

sql-contract is responsible for **query definition and result mapping**. Transaction control (`BEGIN` / `COMMIT` / `ROLLBACK`) and connection lifecycle management are outside its scope — they remain the caller's execution concern.

### What sql-contract manages

- SQL loading and transformation (rewriters, binders)
- Parameter binding and placeholder conversion
- Result row mapping and validation
- Observability events for query execution

### What the caller manages

- Connection pooling and lifecycle (open, close, release)
- Transaction boundaries (`BEGIN` / `COMMIT` / `ROLLBACK`)
- Error recovery and retry policies
- Connection scoping (ensuring related queries share one connection)

### QueryExecutor and connection scoping

The `QueryExecutor` type assumes it runs within a **single connection scope**. When using a connection pool, each call to the executor may be dispatched to a different connection, which makes multi-statement transactions unsafe.

To execute transactional workflows, the caller should obtain a dedicated connection and build the executor from it:

```ts
// Acquire a dedicated connection from the pool
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Build an executor scoped to this connection
  const executor = async (sql: string, params: readonly unknown[]) => {
    const result = await client.query(sql, params as unknown[]);
    return result.rows;
  };

  const reader = createReader(executor);
  const user = await reader.one('SELECT ...', [userId]);
  // ... additional queries on the same connection ...

  await client.query('COMMIT');
} catch (e) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ignore secondary rollback failure
  }
  throw e;
} finally {
  client.release();
}
```

This separation keeps sql-contract focused on the mapping layer while leaving execution policy decisions — such as isolation level, retry logic, and savepoints — in the application layer where they belong.

## DBMS Differences

sql-contract does not normalize SQL dialects or placeholder styles. Use the syntax required by your driver:

```ts
// PostgreSQL ($1, $2, ...)
await executor('SELECT * FROM customers WHERE id = $1', [42])

// Named parameters (:id)
await executor('SELECT * FROM customers WHERE id = :id', { id: 42 })
```

## License

MIT
