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

## Executor and DBMS / Driver integration

`sql-contract` does not execute SQL.
Instead, it connects to DBMS- and driver-specific execution environments through a user-provided **executor** function.

This executor is the only shared infrastructure within `sql-contract`.
All DBMS differences, driver differences, and connection management are fully contained within this layer.

---

### Executor: running SQL and returning rows

An executor is a function that receives `(sql, params)` and returns `Row[]`.

The `params` argument uses the exported `QueryParams` type, which may be either a positional array or a named record.
`sql-contract` never inspects or rewrites parameters; it simply forwards what writer or mapper produces.

```ts
const executor = async (sql: string, params: QueryParams) => {
  const result = await pool.query(sql, params as unknown[])
  return result.rows
}
```

Key principles:

* sql-contract never executes SQL by itself
* Connection pooling, transactions, retries, and error handling belong to the executor
* The executor decides how parameters are bound and how placeholders are interpreted
* As long as `Row[]` is returned, the mapper can consume it

### DBMS and driver differences

`sql-contract` does not normalize SQL dialects or placeholder styles.

Write SQL using the placeholder syntax required by your driver, and bind parameters exactly as that driver expects.
Whether parameters are positional or named is a concern of the executor and driver, not sql-contract.

Examples of common placeholder styles:

| DBMS / driver                     | Placeholder style           |
| --------------------------------- | --------------------------- |
| PostgreSQL / Neon (node-postgres) | `$1`, `$2`, ...             |
| PostgreSQL / pg-promise           | `$/name/` with named values |
| MySQL / SQLite                    | `?`                         |
| SQL Server                        | `@p1`, `@p2`, ...           |
| Oracle                            | `:1`, `:name`, ...          |

```ts
await executor(
  'select * from customers where customer_id = $1',
  [42],
)
```

```ts
await executor(
  'select * from customers where customer_id = $/customerId/',
  { customerId: 42 },
)
```

```ts
await executor(
  'select * from customers where customer_id = :customerId',
  { customerId: 42 },
)
```

The executor layer is where DBMS and driver concerns live.
Writer and mapper remain independent of these differences.

---

## Writer: emitting simple C / U / D statements

The writer helpers (`insert`, `update`, `remove`) provide a small, opinionated DSL for common CUD statements.

They accept table names and plain objects of column-value pairs, and deterministically emit `{ sql, params }`.

Design constraints:

* `undefined` values are omitted
* Identifiers are validated against ASCII-safe patterns unless explicitly allowed
* WHERE clauses are limited to equality-based AND fragments
* No inference, no joins, no multi-table logic

If `returning` is provided, a `RETURNING` clause is appended.
Using `'all'` maps to `RETURNING *`; otherwise, the column list is sorted alphabetically.

The writer never checks backend support for `RETURNING`.
It emits SQL exactly as specified so success or failure remains observable at execution time.

### Preset-driven writer flow

Advanced usage flows through `createWriterFromExecutor`, which binds an executor to a concrete placeholder strategy.

A writer preset deterministically defines:

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

Each statement can be executed directly:

```ts
await writer.insert(
  'projects',
  { name: 'Apollo', owner_id: 7 },
  { returning: ['project_id'] },
)
```

Or built without execution for inspection:

```ts
const built = writer.build.insert(
  'projects',
  { name: 'Apollo', owner_id: 7 },
  { returning: ['project_id'] },
)
```

### Writer presets

| Preset                         | Placeholder style | Params shape              | Description                                                 |
| ------------------------------ | ----------------- | ------------------------- | ----------------------------------------------------------- |
| `indexed()`                    | `$1, $2, …`       | `unknown[]`               | PostgreSQL-style numbered placeholders (default).           |
| `anonymous()`                  | `?`               | `unknown[]`               | Anonymous placeholders used by MySQL and SQLite.            |
| `named({ formatPlaceholder })` | named             | `Record<string, unknown>` | Named placeholders for Oracle, SQL Server, pg-promise, etc. |

### Named placeholder naming

Named presets derive parameter names from column names.

Each bind increments a counter and produces deterministic names such as `name_1`, `owner_id_2`.
These names are passed through `formatPlaceholder` to produce driver-ready placeholders.

```ts
await writer.insert('projects', { name: 'Apollo', owner_id: 7 })
// SQL: INSERT INTO projects (name, owner_id) VALUES (:name_1, :owner_id_2)
// params: { name_1: 'Apollo', owner_id_2: 7 }
```

---

## Mapper: projecting rows into DTOs (R)

Mapping query results back into DTOs is the core mission of `sql-contract`.

The mapper operates strictly on `Row[]` and never guesses column semantics.
It supports three complementary styles:

* explicit entity definitions,
* multi-model mapping from joined rows,
* lightweight duck-typed projection via presets.

Because the mapper never fabricates column names or infers relations, mapping remains transparent and deterministic.

### Explicit entities and relations

Entities describe how columns map to fields and how rows relate to each other.

```ts
import {
  createMapperFromExecutor,
  entity,
} from '@rawsql-ts/sql-contract/mapper'

const customerEntity = entity({
  name: 'customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_id',
    customerName: 'customer_name',
  },
})

const orderEntity = entity({
  name: 'order',
  key: 'orderId',
  prefix: 'order_',
}).belongsTo('customer', customerEntity, 'customerId')
```

Joined queries remain readable and deterministic:

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

### Duck typing and simple mapping

For lightweight use cases, mapper presets allow projecting rows without full entity definitions.

This is useful for:

* exploratory queries,
* legacy schemas,
* read-only DTOs with minimal structure.

Mapping rules are always explicit, local, and opt-in.

---

## Choosing the mapper entry point

The mapper always consumes `Row[]`.
Choose the entry point based on what your database client returns.

### Case A: executor already returns `Row[]`

```ts
const mapper = createMapperFromExecutor(executor)
```

### Case B: client returns wrapped results

Normalize once so sql-contract always sees `Row[]`.

```ts
const mapper = createMapperFromExecutor(
  toRowsExecutor(client, 'query'),
)
```

In both cases, runtime behavior is identical.
Only the executor adaptation differs.

---

## Influences / Related Ideas

Sql-contract is inspired by minimal mapping libraries such as Dapper and other thin contracts that keep SQL visible while wiring rows to typed results. These projects demonstrate the value of stopping short of a full ORM and instead providing a predictable, testable layer for purely mechanical concerns.

Sql-contract adopts that lesson within the rawsql-ts ecosystem: SQL remains the domain language, and this package automates only the tedious bridging work around it.
