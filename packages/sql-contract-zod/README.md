# @rawsql-ts/sql-contract-zod

## Overview

@rawsql-ts/sql-contract-zod maps SQL results to DTOs and validates them with Zod.

Read (R) looks like this:

```ts
// Create a reader (defaults to the appLike preset so snake_case -> camelCase works out of the box).
const reader = createReader(executor)

const customer = await reader.zod(CustomerSchema).one(
  'SELECT customer_id, customer_name FROM customers WHERE customer_id = $1',
  [42],
)
```

Create (C) / Update (U) / Delete (D) look like this:

```ts
// Create a writer for executing simple INSERT / UPDATE / DELETE statements.
const writer = createWriter(executor)

await writer.insert('customers', { name: 'alice', status: 'active' })
await writer.update('customers', { status: 'active' }, { id: 42 })
await writer.remove('customers', { id: 17 })
```

---

## Getting Started

### Installation

```sh
pnpm add @rawsql-ts/sql-contract-zod zod
```

@rawsql-ts/sql-contract-zod depends on `@rawsql-ts/sql-contract` for the mapper helper primitives and adds runtime validation through Zod.

### Minimal CRUD sample

```ts
import { Pool } from 'pg'
import { createWriter } from '@rawsql-ts/sql-contract/writer'
import { createReader, type QueryParams } from '@rawsql-ts/sql-contract/mapper'
import { zNumberFromString, zDateFromString } from '@rawsql-ts/sql-contract-zod'
import { z } from 'zod'

const CustomerSchema = z.object({
  // appLike-style conventions map snake_case columns to camelCase keys.
  customerId: z.number(),
  customerName: z.string(),
  customerStatus: z.string(),
  balance: zNumberFromString,
  joinedAt: zDateFromString,
})

async function main() {
  // Define these once for the whole application.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const executor = async (sql: string, params: QueryParams) => {
    const result = await pool.query(sql, params as unknown[])
    return result.rows
  }

  // Create a reader with common conventions (customizable via presets).
  const reader = createReader(executor)

  // Create a writer for executing simple INSERT / UPDATE / DELETE statements.
  const writer = createWriter(executor)

  const sql = `
  SELECT
    customer_id,
    customer_name,
    customer_status,
    balance,
    joined_date
  FROM customers
  WHERE customer_id = $1
  `

  const customer = await reader.zod(CustomerSchema).one(sql, [42])

  await writer.insert('customers', { name: 'alice', status: 'pending' })
  await writer.update('customers', { status: 'active' }, { id: 42 })
  await writer.remove('customers', { id: 17 })

  await pool.end()
  void customer
}

void main()
```

This snippet shows a typical setup: define an executor, create a reader and writer, validate DTOs with Zod, and execute simple INSERT/UPDATE/DELETE statements.

---

## Features

* Runtime dependency on Zod for validation helpers (no other runtime packages are required)
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
* Zod-aware reader (`reader.zod`) that validates mapped DTOs with preset-based conventions or an explicit RowMapping
* Optional coercion helpers (`zNumberFromString`, `zBigIntFromString`, `zDateFromString`)
* Readers that accept the same `RowMapping` instances your mapper already uses
* `createReader(executor)` applies `mapperPresets.appLike()` by default, so snake_case columns work without extra setup
* Params normalization: omitting params is treated the same as passing `[]`
* Throws the original `ZodError`, keeping logging and monitoring layers intact

---

## Philosophy

### SQL as Specification

How data is retrieved, which fields are selected, how values are transformed, and which conditions are applied are all domain requirements.

SQL is the most precise and unambiguous language for expressing these requirements.
Natural language is not.

### SQL as Fast Feedback

Effective software development depends on rapid iteration across design, implementation, and verification.

Because SQL is executable and directly verifiable, it provides fast and reliable feedback.
DSLs do not.

---

## Direction

### Mechanical Work in Read Queries

When working with raw SQL, certain mechanical tasks are unavoidable.
Mapping returned rows into application-level DTOs is repetitive, straightforward, and not part of the domain logic.

This library focuses on reducing that burden by providing explicit result mapping,
followed by optional DTO validation using Zod after mapping completes.

### Mechanical Work in Write Queries

Write operations such as INSERT, UPDATE, and DELETE usually carry less domain significance than SELECT queries.
They tend to be short, predictable, and mechanically structured.

This library provides minimal builder helpers for common write cases only,
and intentionally goes no further than that.

---

## Executor: DBMS / Driver Integration

`sql-contract-zod` is designed as a reusable, DBMS-agnostic library.
To integrate it with a specific database or driver, you define a small executor function.

An executor receives a SQL string and parameters, executes them using your DB driver,
and returns the resulting rows as `Row[]`.

```ts
const executor = async (sql: string, params: QueryParams) => {
  const result = await pool.query(sql, params as unknown[])
  return result.rows
}
```

This function is the single integration point between `sql-contract-zod` and the DBMS.
All database- and driver-specific concerns-connection pooling, transactions,
retries, and error handling-belong entirely inside the executor.

### Parameters

The `params` argument uses the exported `QueryParams` type.
It supports both positional arrays and named records.

Reader methods always supply a params array (defaulting to `[]`),
so executors may safely treat `params` as `unknown[]` without defensive checks.

---

## Mapper: Query Result Mapping (R)

The mapper is responsible for projecting query results (`Row[]`) into DTOs.

In a typical application, a mapper is created once and reused across queries.
It defines application-wide projection behavior,
while individual queries decide the DTO shape.

The mapper operates purely on returned rows and never inspects SQL,
parameters, or execution behavior.
To keep mapping predictable, it does not guess column semantics or relationships.
It focuses on structural projection and column name normalization only.
Value coercion is intentionally handled by Zod.

```ts
import { createReader, mapperPresets } from '@rawsql-ts/sql-contract/mapper'

const reader = createReader(executor)
const readerWithOverrides = createReader(executor, mapperPresets.safe())
```

---

### Query result cardinality: `one` and `list`

Reader methods distinguish between queries that return a single row
and those that return multiple rows.

```ts
const row = await reader.zod(Schema).one(sql, params)
// row is DTO

const rows = await reader.zod(Schema).list(sql, params)
// rows is DTO[]
```

`one(...)` enforces an exact cardinality contract:

- **0 rows** -> throws an error
- **1 row** -> returns a DTO
- **n rows (n >= 2)** -> throws an error

`list(...)` performs no cardinality checks:

- **0 rows** -> returns an empty array `[]`
- **1 row** -> returns an array with one DTO
- **n rows (n >= 2)** -> returns an array of `n` DTOs

When using `reader.zod(...)`, Zod validation is performed first,
and the cardinality check is applied afterward.

---

### Zod helpers overview

| Helper | Description |
| ------ | ----------- |
| `reader.zod` | Validates mapped DTOs with Zod before returning them |
| `parseRows` / `parseRow` | Validate DTOs obtained from other sources |
| `zNumberFromString` | Accepts numbers or numeric strings |
| `zBigIntFromString` | Accepts bigints or strings |
| `zDateFromString` | Accepts `Date` objects or ISO strings |

All helpers propagate the original `ZodError`.

---

### Duck-typed mapping (no model definitions)

For lightweight or localized use cases,
the reader supports duck-typed projections without defining schemas.

```ts
const rows = await reader.list<{ customerId: number }>(
  'select customer_id from customers limit 1',
)
```

You can also omit the DTO type:

```ts
const rows = await reader.list(
  'select customer_id from customers limit 1',
)
```

---

### Single DTO with Zod (recommended)

```ts
import { z } from 'zod'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
})

const sql = `
  select
    customer_id,
    customer_name
  from customers
  where customer_id = $1
`

const row = await reader.zod(CustomerSchema).one(sql, [42])
```

---

### Mapping to multiple models (joined rows)

You can map joined result sets into multiple related DTOs.
Relations are explicitly defined and never inferred.

```ts
const customerMapping = rowMapping({
  name: 'customer',
  key: 'customerId',
})

const orderMapping = rowMapping({
  name: 'order',
  key: 'orderId',
}).belongsTo('customer', customerMapping, 'customerId')
```

```ts
const rows = await reader.zod(OrderSchema, orderMapping).list(sql, [42])
```

In multi-model mappings, related DTOs are **interned by their key**.
If multiple rows reference the same key, the same related instance is reused.

```ts
rows[0].customer === rows[1].customer // true (same customerId)
```

Mutating related DTOs in place will affect all rows that reference them.

---

## Writer: emitting simple C / U / D statements

The writer helpers provide a small, opinionated DSL for common INSERT,
UPDATE, and DELETE statements.

At its core, the writer constructs `{ sql, params }`.
When bound to an executor, it also executes those statements.

### Executing statements

```ts
await writer.insert('projects', { name: 'Apollo', owner_id: 7 })
await writer.update('projects', { name: 'Apollo' }, { project_id: 1 })
await writer.remove('projects', { project_id: 1 })
```

### Building statements without execution

```ts
const stmt = writer.build.insert('projects', { name: 'Apollo', owner_id: 7 })
```

---

## CUD with RETURNING

When write statements return rows,
consume the result with a reader to map and validate DTOs.

```ts
const stmt = writer.build.insert(
  'users',
  { user_name: 'alice' },
  { returning: ['user_id', 'user_name'] },
)

const row = await reader.zod(CreatedUserSchema).one(stmt.sql, stmt.params)
```

---

## DBMS and driver differences

All DBMS- and driver-specific concerns live in the executor.
Both writer and mapper remain independent of these differences.

---

## Influences / Related Ideas

sql-contract-zod is inspired by minimal mapping libraries such as Dapper,
favoring explicit SQL and thin, predictable mapping layers.
