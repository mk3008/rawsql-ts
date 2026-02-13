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

For larger projects, `createCatalogExecutor` executes queries through a `QuerySpec` contract instead of raw SQL. A `QuerySpec` couples an SQL file, parameter shape, and output rules into a stable identity for debugging and observability.

```ts
import { createCatalogExecutor } from '@rawsql-ts/sql-contract'

const catalog = createCatalogExecutor({
  sqlLoader: (specId) => loadSqlFile(specId),
  executor,
})
```

When observability is enabled, execution emits lifecycle events (`query_start`, `query_end`, `query_error`) with spec metadata, allowing queries to be traced by specification rather than raw SQL strings.

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
