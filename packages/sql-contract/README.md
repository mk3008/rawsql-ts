
# @rawsql-ts/sql-contract

## Overview

`@rawsql-ts/sql-contract` is a lightweight library for reducing repetitive, mechanical code around handwritten SQL.  
It focuses on mapping query results into application-typed models and simplifying common CUD (Create / Update / Delete) statement construction.

## Getting Started

### Installation

```sh
pnpm add @rawsql-ts/sql-contract
```

### Minimal CRUD sample

```ts
import { Pool } from 'pg'
import {
  createReader,
  createWriter,
  type QueryParams
} from '@rawsql-ts/sql-contract'

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  const executor = async (sql: string, params: QueryParams) => {
    const result = await pool.query(sql, params as unknown[])
    return result.rows
  }

  const reader = createReader(executor)
  const writer = createWriter(executor)

  const rows = await reader.list(
    `SELECT customer_id, customer_name FROM customers WHERE status = $1`,
    ['active']
  )

  await writer.insert('customers', { name: 'alice', status: 'active' })
  await writer.update(
    'customers',
    { status: 'inactive' },
    { id: 42 }
  )
  await writer.remove('customers', { id: 17 })

  await pool.end()

  void rows
}
```

## Features

* Zero runtime dependencies
* Zero DBMS and driver dependencies
* Works with any SQL-executor returning rows
* Minimal mapping helpers for SELECT results
* Simple builders for INSERT / UPDATE / DELETE

## Philosophy

### SQL as Domain Specification

SQL is the primary language for expressing domain requirements—precise, unambiguous, and directly verifiable against the database.

Mapping returned rows to typed domain models is mechanical and repetitive.
This library removes that burden, letting domain logic remain in SQL.

Write operations (INSERT/UPDATE/DELETE) are usually repetitive and predictable.
So the library offers simple builders for common cases only.

## Concepts

### Executor: DBMS / Driver Integration

To integrate with any database or driver, define a single executor:

```ts
const executor = async (sql: string, params: QueryParams) => {
  const result = await pool.query(sql, params as unknown[])
  return result.rows
}
```

Connection pooling, retries, transactions, and error handling belong inside the executor.

### Reader: Query Execution and Result Mapping

Reader executes SELECT queries and maps raw database rows into application-friendly structures.

It supports multiple levels of mapping depending on your needs,
from quick projections to fully validated domain models.

### Catalog executor: QuerySpec contract and observability

Catalog executor executes queries through a `QuerySpec` instead of running raw
SQL directly.

A `QuerySpec` defines a stable query contract that couples an SQL file,
parameter shape, and output rules. By executing queries through this contract,
the executor can enforce parameter expectations, apply output mapping or
validation, and provide a stable identity for debugging and observability.

`createCatalogExecutor` is wired with a SQL loader and a concrete query executor,
and can optionally apply rewriters, binders, SQL caching,
`allowNamedParamsWithoutBinder`, extensions, or an `observabilitySink`.

When observability is enabled, execution emits lifecycle events
(`query_start`, `query_end`, `query_error`) including `spec.id`, `sqlFile`,
and execution identifiers, allowing queries to be traced and debugged by
specification rather than raw SQL strings.

---

#### Basic result APIs: one and list

Reader provides two primary methods:

- one : returns a single row
- list : returns multiple rows

```ts
const customer = await reader.one(
  'select customer_id, customer_name from customers where customer_id = $1',
  [1]
)

const customers = await reader.list(
  'select customer_id, customer_name from customers'
)
```

These methods focus only on execution.
Mapping behavior depends on how the reader is configured.

---

#### Duck typing (minimal, disposable)

For quick or localized queries, you can rely on structural typing without defining models.

```ts
const rows = await reader.list<{ customerId: number }>(
  'select customer_id from customers limit 1',
)
```

You can also omit the DTO type entirely:

```ts
const rows = await reader.list(
  'select customer_id from customers limit 1',
)
```

This approach is:

* Fast to write
* Suitable for one-off queries
* No runtime validation

---

#### Custom mapping

Reader allows custom projection logic when structural mapping is insufficient.

```ts
const rows = await reader.map(
  'select price, quantity from order_items',
  (row) => ({
    total: row.price * row.quantity,
  })
)
```

This is useful for:

* Derived values
* Format conversion
* Aggregated projections

---


#### Column naming conventions (default behavior)

Reader applies a default naming rule that converts snake_case database columns
into camelCase JavaScript properties.

This allows most queries to work without explicit mapping.

Example:

```sql
select customer_id, created_at from customers
```

becomes:

```ts
{
  customerId: number
  createdAt: Date
}
```

No mapping definition is required for this transformation.

---

#### Mapper presets

You can configure how column names are transformed.

Example:

```ts
const reader = createReader(executor, mapperPresets.safe())
```

Common presets include:

* appLike : snake_case → camelCase conversion
* safe : no column name transformation

Choose a preset based on how closely your domain models align with database naming.

---

#### When explicit mapping is useful

Even with automatic naming conversion, explicit mappings become valuable when:

* Domain terms differ from column names
* Multiple columns combine into one field
* Queries are reused across modules
* Schema stability should be decoupled from application models

---

#### Single model mapping (reusable definition)

Mapping models provide explicit control over how rows map to domain objects.

Example:

```ts
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
  .list(`
    select
      order_id,
      customer_display_name,
      grand_total
    from order_view
  `)
```

In this example:

* Domain terminology differs from database naming
* Mapping clarifies intent
* The definition can be reused across queries

Benefits:

* Reusable mapping definitions
* Explicit domain language alignment
* Reduced accidental schema coupling
* Better long-term maintainability

---

#### Composite keys

`rowMapping` keys can now be more than a single column without breaking existing consumers:

* **Array-based composite keys** — pass the raw column names in SQL order (`key: ['col_a', 'col_b']`). These column values are extracted directly from the executor’s row, so `columnMap` / `prefix` rules are not involved.
* **Derived keys** — supply a function, e.g. `key: (row) => [row.col_a, row.col_b]`, that returns strings/numbers/bigints or an array thereof. The library type-tags each component so `'1'` and `1` are never conflated, and order of the array is preserved.

Both forms feed through a single normalization path, so you can combine mixed types safely and receive clear errors if a value is `null`, `undefined`, or missing. Creating a synthetic column inside SQL (e.g. `SELECT CONCAT(col_a, '|', col_b) AS composite_key`) still works as a workaround, but we recommend using the multi-column helpers because they keep the schema explicit and avoid delimiter collisions.

`name` continues to serve as the user-visible label for error messages, independent of whether the key is scalar, composite, or derived.

#### Multi-model mapping

Reader supports mapping joined results into multiple domain models by composing `rowMapping` definitions.

```ts
const customerMapping = rowMapping({
  name: 'Customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_customer_id',
    customerName: 'customer_customer_name',
  },
})

const orderMapping = rowMapping<{
  orderId: number
  orderTotal: number
  customerId: number
  customer: { customerId: number; customerName: string }
}>({
  name: 'Order',
  key: 'orderId',
  columnMap: {
    orderId: 'order_order_id',
    orderTotal: 'order_total',
    customerId: 'order_customer_id',
  },
}).belongsTo('customer', customerMapping, 'customerId')

const result = await reader
  .bind(orderMapping)
  .list(`
    select
      c.id as customer_customer_id,
      c.name as customer_customer_name,
      o.id as order_order_id,
      o.total as order_total,
      o.customer_id as order_customer_id
    from customers c
    join orders o on o.customer_id = c.customer_id
  `)
```

`belongsTo` attaches each customer row to its owning order, so the mapped result exposes a nested `customer` object without duplicating join logic.

This enables structured projections from complex joins.

---

#### Validator-backed mapping (recommended)

Runtime validation ensures data correctness.
Zod integration is the recommended approach.

```ts
import { z } from 'zod'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
})

const row = await reader
  .validator(CustomerSchema)
  .one(
    'select customer_id, customer_name from customers where customer_id = $1',
    [1]
  )
```

Benefits include:

* Runtime safety
* Explicit schema documentation
* Refactoring confidence
* AI-friendly feedback loops

---

### Scalar Queries

Use scalar helpers when a query returns a single value.

#### Basic scalar usage

```ts
const count = await reader.scalar(
  'select count(*) from customers where status = $1',
  ['active']
)
```

This is useful for:

* COUNT queries
* Aggregate values
* Existence checks

---

#### Typed scalar mapping

You can explicitly define the expected scalar type.

```ts
const count = await reader.scalar<number>(
  'select count(*) from customers where status = $1',
  ['active']
)
```

This improves readability and helps prevent accidental misuse.

---

#### Scalar validation with Zod (recommended)

For stricter guarantees, scalar values can be validated at runtime.

```ts
import { z } from 'zod'

const count = await reader.scalar(
  z.number(),
  'select count(*) from customers where status = $1',
  ['active']
)
```

This approach ensures:

* Runtime type safety
* Clear intent
* Safer refactoring

---

### Zod integration and coercion helpers

Reader integrates smoothly with Zod for runtime validation and safe type conversion.

Zod validation helps ensure that query results match your domain expectations,
especially when working with numeric or date values returned as strings by drivers.

---

#### Row validation with Zod

```ts
import { z } from 'zod'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
})

const row = await reader
  .validator(CustomerSchema)
  .one(
    'select customer_id, customer_name from customers where customer_id = $1',
    [1]
  )
```

This provides:

* Runtime safety
* Clear schema documentation
* Refactoring confidence

---

#### Scalar validation with Zod

```ts
const count = await reader.scalar(
  z.number(),
  'select count(*) from customers'
)
```

---

#### Coercion helpers for numeric values

Some database drivers return numeric values as strings.
The package provides helpers to safely convert them.

Example:

```ts
import { z } from 'zod'
import {
  zNumberFromString,
  zBigIntFromString
} from '@rawsql-ts/sql-contract-zod'

const schema = z.object({
  totalAmount: zNumberFromString,
  largeCounter: zBigIntFromString,
})
```

These helpers:

* Convert strings into numeric types
* Fail fast when values are invalid
* Reduce manual parsing logic

---

#### When to use coercion

Use coercion helpers when:

* Working with NUMERIC / DECIMAL columns
* Drivers return BIGINT as strings
* You want runtime guarantees

---

### Writer: Simple CUD Helpers

Writer helpers build simple INSERT/UPDATE/DELETE SQL:

```ts
await writer.insert('projects', {
  name: 'Apollo',
  owner_id: 7
})

await writer.update(
  'projects',
  { name: 'Apollo' },
  { project_id: 1 }
)

await writer.remove('projects', { project_id: 1 })
```

You can also build statements without execution:

```ts
const stmt = writer.build.insert(
  'projects',
  { name: 'Apollo' }
)
```

## Reducers (Coercion Helpers)

The package exposes pure coercion helpers:

* `decimalStringToNumberUnsafe`
* `bigintStringToBigInt`

They convert raw DB output strings into numbers or bigints when needed.

## DBMS Differences

sql-contract does not normalize SQL dialects or placeholder styles.
You must use the placeholder syntax required by your driver.

Examples:

```ts
await executor(
 'select * from customers where id = $1',
 [42],
)
await executor(
 'select * from customers where id = :id',
 { id: 42 },
)
```

## Influences / Related Ideas

sql-contract is inspired by minimal mapping libraries such as Dapper,
stopping short of a full ORM and instead providing a predictable, transparent layer.
