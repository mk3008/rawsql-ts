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

## 実行環境の準備

sql-contract は少量の配線を用意するだけで、さまざまなDBMSに対応させることが可能です。

クエリを実行するコードを書く前に、以下の内容を記述しましょう。

- **エグゼキュータ**: SQL の実行方法と行の返方法
- **プレースホルダ**: SQL でのパラメータの記述方法
- **マッピングルール**:
  - クエリ間で共有される共通ルール
  - クエリごとに適用される 1 回限りのルール

---

### Executor: running SQL and returning rows

An executor is a function that receives `(sql, params)` and returns `Row[]`.  
The `params` argument matches the exported `QueryParams` type?either a positional array or a named record?because sql-contract simply forwards whatever the mapper passes.

```ts
const executor = async (sql: string, params: QueryParams) => {
  const result = await pool.query(sql, params as unknown[])
  return result.rows // must be Row[]
}
```

Key points:

- Sql-contract never executes SQL by itself
- Connection pooling, transactions, retries, and error handling live in the executor
- The executor/driver decides how to bind the received `params` (array or object) and how placeholders should be written
- As long as `Row[]` is returned, the mapper can consume it

---

### Placeholders and DBMS dialects

Sql-contract does not rewrite SQL or interpret placeholders.  
Keep your SQL consistent with the placeholder style expected by your driver, and forward placeholder bindings exactly as the driver needs them. The mapper accepts either arrays or named records (`QueryParams`), so the executor/driver decides which style to use.

| DBMS / driver | Placeholder style |
| --- | --- |
| PostgreSQL / Neon (node-postgres) | `$1`, `$2`, ... |
| PostgreSQL / pg-promise | `$/name/` + named `values` object |
| MySQL / SQLite | `?`, `?`, ... |
| SQL Server | `@p1`, `@p2`, ... |
| Oracle | `:1`, `:name`, ... |

```ts
// Positional PostgreSQL-style placeholders with an array
await executor(
  'select * from customers where customer_id = $1',
  [42],
)
```

```ts
// pg-promise named parameters
await executor(
  'select * from customers where customer_id = $/customerId/',
  { customerId: 42 },
)
```

```ts
// Driver-specific named placeholders, bound via an object
await executor(
  'select * from customers where customer_id = :customerId',
  { customerId: 42 },
)
```

---

### Mapping rules: common vs one-time

Mapping rules define how raw driver rows are projected into DTOs.

#### Common mapping rules (project-wide defaults)

Use presets when the same conventions apply across most queries.

```ts
const mapper = createMapperFromExecutor(
  executor,
  mapperPresets.appLike(),
)
```

| Preset | Column names | Date coercion | Intended use |
| --- | --- | --- | --- |
| `appLike()` | `snake_case` -> `camelCase` | enabled | PostgreSQL-style schemas |
| `safe()` | unchanged | disabled | Maximum transparency |

---

#### One-time mapping rules (per query)

When a query needs special handling, override mapping locally instead of changing global defaults.

```ts
const rows = await mapper.query<Customer>(
  sql,
  params,
  {
    keyTransform: (column) =>
      column === 'customer_id' ? 'customerId' : column,
  },
)
```

Use one-time rules for edge cases, legacy schemas, or exceptional naming.

---

### Choosing the mapper entry point

Sql-contract expects the mapper to receive `Row[]`.  
Choose the entry point based on what your database client returns.

#### Case A: your executor already returns `Row[]`

This is the most common case.

```ts
const mapper = createMapperFromExecutor(
  executor,
  mapperPresets.appLike(),
)
```

#### Case B: your client returns an object wrapper

Some clients return objects such as `{ rows }` or `{ recordset }`.  
Normalize this shape once so that sql-contract always sees `Row[]`.

```ts
const mapper = createMapperFromExecutor(
  toRowsExecutor(client, 'query'),
  mapperPresets.appLike(),
)
```

In both cases, the mapper behaves identically at runtime.  
The difference is only how the executor is adapted.

---

## Writer: Advanced Usage (C / U / D)

The writer helpers (`insert`, `update`, `remove`) are intentionally opinionated. They accept table names plus plain objects of columns and values, and emit `{ sql, params }`.

Undefined values are omitted, identifiers are validated against ASCII-safe patterns unless `allowUnsafeIdentifiers` is enabled, and WHERE clauses are limited to equality-based AND fragments to avoid speculative logic.

If you pass `returning`, the helper extends the SQL with a `RETURNING` clause. Using `'all'` maps to `RETURNING *`; otherwise, the provided column list is sorted alphabetically. Sql-contract does not check whether the backend supports `RETURNING`; it simply emits the SQL so that support or failure is observable at execution time.

The writer remains declarative: it never executes SQL, never infers column names, and never intertwines multiple tables. It formalizes only the contract your code already intends to express.

### Preset-driven writer flow

Advanced writer usage now flows through `createWriterFromExecutor`, which binds your executor to a `writerPresets` configuration. Each preset represents a concrete SQL dialect and deterministically produces:

1. the placeholder text that will be emitted in the SQL,
2. the `QueryParams` shape (array for positional styles, record for named styles),
3. a binder that assigns parameters in driver-friendly order.

This keeps the executor agnostic of the placeholder construction while ensuring parameters remain in lockstep with the emitted SQL.

Each statement still takes `returning` and `allowUnsafeIdentifiers` via `WriterStatementOptions`. Placeholder strategy, parameter shape, and naming rules now live exclusively in the preset.

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

const built = writer.build.insert(
  'projects',
  { name: 'Apollo', owner_id: 7 },
  { returning: ['project_id'] },
)

await writer.insert('projects', { name: 'Apollo', owner_id: 7 }, {
  returning: ['project_id'],
})
```

Use `writer.build.<statement>` when you need to inspect the generated `{ sql, params }` tuple (including `returning` metadata) before execution. Call `<writer>.insert|update|remove` to hand the SQL directly to your executor, knowing the preset already prepared the correct placeholders and parameter shape.

#### Presets

| Preset | Placeholder style | Params shape | Description |
| --- | --- | --- | --- |
| `writerPresets.indexed()` | `$1, $2, …` | `unknown[]` | PostgreSQL-style numbered placeholders. This preset is the `createWriterFromExecutor(executor)` default. |
| `writerPresets.anonymous()` | `?` | `unknown[]` | Anonymous placeholders used by MySQL/SQLite. |
| `writerPresets.named({ formatPlaceholder })` | named (e.g. `:name`, `@name`, `$/name/`) | `Record<string, unknown>` | Column-based names with sequential counters so each bind can be formatted for Oracle/SQL Server/pg-promise. Provide `formatPlaceholder` to add the appropriate dialect prefix. |

#### Named placeholder naming

The named preset automatically derives parameter names from column names passed to the writer helpers. Each `insert` value, `update` SET entry, and `WHERE` binding increments a counter, appends it to a sanitized column name (`name_1`, `owner_id_2`, …), adds the entry to the params object, and passes the result into `formatPlaceholder`. This produces deterministic driver-ready placeholders such as `:name_1`, `@owner_id_2`, or `$/name_1/`.

```ts
const writer = createWriterFromExecutor(
  executor,
  writerPresets.named({
    formatPlaceholder: (paramName) => ':' + paramName,
  }),
)

await writer.insert('projects', { name: 'Apollo', owner_id: 7 })
// SQL: INSERT INTO projects (name, owner_id) VALUES (:name_1, :owner_id_2)
// params: { name_1: 'Apollo', owner_id_2: 7 }
```

---

## Mapper: Advanced Usage (R)

Mapping rows back into DTOs is the core mission of sql-contract. The mapper helpers rely on explicit entity definitions (`entity({ name, key, prefix })`, relations, column maps, and guards) to describe how each SQL result should be shaped.

You can hydrate a single model, map multiple models from the same row set, or lazily duck-type results via `mapperPresets` and custom coercion hooks. Because the mapper never fabricates column names or guesses relation keys, the resulting domain logic remains transparent and predictable.

If you already handwrite SQL, the mapper is the smallest possible addition: it handles the mechanical task of mapping columns to fields so the rest of your code can stay focused on the intent expressed in SQL.

Explicit entity definitions plus relations keep joined queries deterministic and readable:

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

## Influences / Related Ideas

Sql-contract is inspired by minimal mapping libraries such as Dapper and other thin contracts that keep SQL visible while wiring rows to typed results. These projects demonstrate the value of stopping short of a full ORM and instead providing a predictable, testable layer for purely mechanical concerns.

Sql-contract adopts that lesson within the rawsql-ts ecosystem: SQL remains the domain language, and this package automates only the tedious bridging work around it.
