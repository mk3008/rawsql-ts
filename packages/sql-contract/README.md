# @rawsql-ts/sql-contract

## Overview

@rawsql-ts/sql-contract is a lightweight library designed to reduce the repetitive, mechanical code commonly encountered when working with handwritten SQL.

It improves the following aspects of the development experience:

- Mapping query results to models
- Writing simple INSERT, UPDATE, and DELETE statements

---

## Features

* Zero runtime dependencies
  (pure JavaScript; no external packages required at runtime)
* Zero DBMS dependency
  (tested with PostgreSQL, MySQL, SQL Server, and SQLite)
* Zero database client dependency
  (works with any client that executes SQL and returns rows)
* Zero framework and ORM dependency
  (fits into any application architecture that uses raw SQL)
* No schema models or metadata required
  (tables, columns, and relationships are defined only in SQL)
* Result mapping helpers that operate on any SQL returning rows
  (including SELECT queries and CUD statements with RETURNING or aggregate results)
* Simple builders for common INSERT, UPDATE, and DELETE cases, without query inference

---

## Philosophy

sql-contract treats SQL?especially SELECT statements?as a language for expressing domain requirements.

In SQL development, it is essential to iterate quickly through the cycle of design, writing, verification, and refinement. To achieve this, a SQL client is indispensable. SQL must remain SQL, directly executable and verifiable; it cannot be adequately replaced by a DSL without breaking this feedback loop.

Based on this philosophy, this library intentionally does not provide query construction features for SELECT statements. Queries should be written by humans, as raw SQL, and validated directly against the database.

At the same time, writing SQL inevitably involves mechanical tasks. In particular, mapping returned rows to application-level models is not part of the domain logic, yet it often becomes verbose and error-prone. sql-contract focuses on reducing this burden.

By contrast, write operations such as INSERT, UPDATE, and DELETE generally do not carry the same level of domain significance as SELECT statements. They are often repetitive, consisting of short and predictable patterns such as primary-key-based updates.

To address this, the library provides minimal builder helpers for common cases only.

It deliberately goes no further than this.

---

## Getting Started

### Installation

```sh
pnpm add @rawsql-ts/sql-contract
```
### Minimal CRUD sample

```ts
import { Pool } from 'pg'
import { insert, update, remove } from '@rawsql-ts/sql-contract/writer'
import {
  createMapperFromExecutor,
  mapperPresets,
  type QueryParams,
} from '@rawsql-ts/sql-contract/mapper'

type Customer = {
  customerId: number
  customerName: string
  customerStatus: string
}

async function main() {
  // Prepare an executor that runs SQL and returns rows.
  // sql-contract remains DBMS- and driver-agnostic by depending only on this function.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const executor = async (sql: string, params: QueryParams) => {
    const result = await pool.query(sql, params as unknown[])
    return result.rows
  }

  // SELECT:
  // Map snake_case SQL columns to a typed DTO without writing per-column mapping code.
  const mapper = createMapperFromExecutor(executor, mapperPresets.appLike())
  const rows = await mapper.query<Customer>(
    `
    select
      customer_id,
      customer_name,
      customer_status
    from customers
    where customer_id = $1
    `,
    [42],
  )

  // INSERT:
  // Simplify repetitive SQL for common write operations.
  const insertResult = insert('customers', {
    name: 'alice',
    status: 'pending',
  })
  await executor(insertResult.sql, insertResult.params)

  // UPDATE:
  // Simplify repetitive SQL for common write operations.
  const updateResult = update(
    'customers',
    { status: 'active' },
    { id: 42 },
  )
  await executor(updateResult.sql, updateResult.params)

  // DELETE:
  // Simplify repetitive SQL for common write operations.
  const deleteResult = remove('customers', { id: 17 })
  await executor(deleteResult.sql, deleteResult.params)

  await pool.end()
  void rows
}

void main()
```

---

## Executor: DBMS / Driver Integration

`sql-contract` is designed as a reusable, DBMS-agnostic library.
To integrate it with a specific database or driver, **you must define a small executor function**.

An executor receives a SQL string and parameters, executes them using your DB driver, and returns the resulting rows as `Row[]`.
By doing so, `sql-contract` can consume query results without knowing anything about the underlying database or driver.

```ts
const executor = async (sql: string, params: QueryParams) => {
  const result = await pool.query(sql, params as unknown[])
  return result.rows
}
```

This function is the single integration point between `sql-contract` and the DBMS.
Connection pooling, transactions, retries, error handling, and other DBMS- or driver-specific concerns should all be handled within the executor.

The `params` argument uses the exported `QueryParams` type.
It supports both positional arrays and named records, allowing executors to work with positional, anonymous, or named parameter styles depending on the driver.

---
## Mapper: Query Result Mapping (R)

The mapper is responsible for projecting query results (`Row[]`) into DTOs.

In a typical application, a mapper is created once and reused across queries.
It defines application-wide mapping behavior, while individual queries decide how results are projected.

The mapper operates purely on returned rows and never inspects SQL, parameters, or execution behavior.
To keep mapping predictable, it does not guess column semantics or relationships.
All transformations are applied through explicit configuration.

```ts
import {
  createMapperFromExecutor,
  mapperPresets,
} from '@rawsql-ts/sql-contract/mapper'

// `executor` is defined according to the Executor section above.
const mapper = createMapperFromExecutor(
  executor,
  mapperPresets.appLike(),
)
```

This example shows a typical mapper setup.

`createMapperFromExecutor` binds an executor to a mapper and accepts optional mapping options.
These options control how column names are normalized, how values are coerced, and how identifiers are treated.

For convenience, `mapperPresets` provide reusable configurations for common scenarios:

| Preset                    | Description                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mapperPresets.appLike()` | Applies common application-friendly defaults, such as snake_case to camelCase conversion and date coercion. |
| `mapperPresets.safe()`    | Leaves column names and values untouched, suitable for exploratory queries or legacy schemas.               |

When a specific query needs fine-grained control, you can also provide a custom options object.
This allows localized adjustments without changing the preset used elsewhere.

```ts
const mapper = createMapperFromExecutor(executor, {
  keyTransform: 'snake_to_camel',
  coerceDates: true,
  idKeysAsString: true,
  typeHints: {
    createdAt: 'date',
  },
})
```

This form mirrors `mapperPresets.appLike()` while allowing targeted overrides for a specific mapping.

---

### Duck-typed mapping (no model definitions)

For lightweight or localized use cases, the mapper supports duck-typed projections without defining any schema or entity models.

In duck-typed mapping, the mapper applies no additional structural assumptions beyond its configured defaults.
The shape of the result is defined locally at the query site, either by providing a TypeScript type or by relying on the raw row shape.

```ts
// Explicitly typed projection
const rows = await mapper.query<{ customerId: number }>(
  'select customer_id from customers limit 1',
)
```

Although not recommended, you can omit the DTO type for quick exploration:

```ts
const rows = await mapper.query(
  'select customer_id from customers limit 1',
)
```

Duck-typed mapping is intentionally minimal and local.
If the shape of the query results is important or reused throughout your application, consider moving to explicit entity-based mapping.

---

### Mapping to a single model

When query results represent a stable shape within a repository, you can map them to a typed DTO without defining an entity.
This is the same duck-typed projection shown earlier, but you explicitly provide the target shape so TypeScript can type-check each row.

```ts
type Customer = {
  customerId: number
  customerName: string
}

const rows = await mapper.query<Customer>(
  `
    select
      customer_id,
      customer_name
    from customers
    where customer_id = $1
  `,
  [42],
)
```

The mapper presets you configure control the normalization rules applied here:

* `mapperPresets.appLike()` applies `snake_case`→`camelCase`, coerces ISO dates, and stringifies identifier-like columns.
* `mapperPresets.safe()` keeps column names and values exactly as they arrive from SQL so you can type the raw output.

Because this path runs the simple-mapping helpers, the same defaults affect `mapper.queryOne<T>`, `mapper.query<T[]>`, and any other helper that omits an entity.

If you need to customize column names, prefixes, or intend to compose the row with other models, define an explicit entity and pass it as the final argument:

```ts
const customerEntity = entity<Customer>({
  name: 'Customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_id',
    customerName: 'customer_name',
  },
})

const rows = await mapper.query<Customer>(
  `
    select
      customer_id,
      customer_name
    from customers
    where customer_id = $1
  `,
  [42],
  customerEntity,
)

// rows[0].customerName is type-safe
```

Explicit entity mappings are required when the model participates in joins or relations; that form is covered in the next section.

---

### Mapping to multiple models (joined rows)

The mapper also supports mapping joined result sets into multiple related models.

Relations are explicitly defined and never inferred.

```ts
const orderEntity = entity({
  name: 'order',
  key: 'orderId',
  prefix: 'order_',
}).belongsTo('customer', customerEntity, 'customerId')
```

Joined queries remain transparent and deterministic:

```ts
const mapper = createMapperFromExecutor(executor)

const rows = await mapper.query(
  `
    select
      o.order_id,
      o.order_total,
      c.customer_id,
      c.customer_name
    from orders o
    join customers c on c.customer_id = o.customer_id
    where o.order_id = $1
  `,
  [123],
  orderEntity,
)
```

---

## Writer: emitting simple C / U / D statements

The writer helpers provide a small, opinionated DSL for common
INSERT, UPDATE, and DELETE statements.

They accept table names and plain objects of column-value pairs, and deterministically emit `{ sql, params }`.

The writer focuses on *construction*, not execution.

### Writer basics

Writer helpers are intentionally limited:

* `undefined` values are omitted
* identifiers are validated against ASCII-safe patterns unless explicitly allowed
* WHERE clauses are limited to equality-based AND fragments
* no inference, no joins, no multi-table logic

If `returning` is provided, a `RETURNING` clause is appended.
Using `'all'` maps to `RETURNING *`; otherwise, column names are sorted alphabetically.

The writer never checks backend support for `RETURNING`.
It emits SQL exactly as specified so that success or failure remains observable at execution time.

### INSERT

```ts
await writer.insert(
  'projects',
  { name: 'Apollo', owner_id: 7 },
  { returning: ['project_id'] },
)
```

### UPDATE

```ts
await writer.update(
  'projects',
  { name: 'Apollo' },
  { project_id: 1 },
)
```

### DELETE

```ts
await writer.remove(
  'projects',
  { project_id: 1 },
)
```

Statements can also be built without execution:

```ts
const built = writer.build.insert(
  'projects',
  { name: 'Apollo', owner_id: 7 },
  { returning: ['project_id'] },
)
```

### Writer presets and placeholder strategies

Advanced usage flows through `createWriterFromExecutor`,
which binds an executor to a concrete placeholder strategy.

A writer preset defines:

1. how placeholders are formatted,
2. whether parameters are positional or named,
3. how parameters are ordered and bound.

```ts
import {
  createWriterFromExecutor,
  writerPresets,
} from '@rawsql-ts/sql-contract/writer'

const writer = createWriterFromExecutor(
  executor,
  writerPresets.named({
    formatPlaceholder: (paramName) => ':' + paramName,
  }),
)
```

### Named placeholders

Named presets derive parameter names from column names.

Each bind increments a counter and produces deterministic names such as
`name_1`, `owner_id_2`.

```ts
await writer.insert('projects', { name: 'Apollo', owner_id: 7 })
// SQL: INSERT INTO projects (name, owner_id) VALUES (:name_1, :owner_id_2)
// params: { name_1: 'Apollo', owner_id_2: 7 }
```

---

## DBMS and driver differences

`sql-contract` does not normalize SQL dialects or placeholder styles.

Write SQL using the placeholder syntax required by your driver, and bind parameters exactly as that driver expects.
Whether parameters are positional or named is a concern of the executor and driver, not `sql-contract`.

Examples of common placeholder styles:

| DBMS / driver                     | Placeholder style  |
| --------------------------------- | ------------------ |
| PostgreSQL / Neon (node-postgres) | `$1`, `$2`, ...    |
| PostgreSQL / pg-promise           | `$/name/`          |
| MySQL / SQLite                    | `?`                |
| SQL Server                        | `@p1`, `@p2`, ...  |
| Oracle                            | `:1`, `:name`, ... |

```ts
await executor(
  'select * from customers where customer_id = $1',
  [42],
)
```

```ts
await executor(
  'select * from customers where customer_id = :customerId',
  { customerId: 42 },
)
```

All DBMS- and driver-specific concerns live in the executor.
Both writer and mapper remain independent of these differences.

---

## Influences / Related Ideas

Sql-contract is inspired by minimal mapping libraries such as Dapper and other thin contracts that keep SQL visible while wiring rows to typed results. These projects demonstrate the value of stopping short of a full ORM and instead providing a predictable, testable layer for purely mechanical concerns.

Sql-contract adopts that lesson within the rawsql-ts ecosystem: SQL remains the domain language, and this package automates only the tedious bridging work around it.
