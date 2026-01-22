# @rawsql-ts/sql-contract

## Overview

@rawsql-ts/sql-contract is a library designed to reduce the friction of model mapping in SELECT queries and the repetitive boilerplate involved in INSERT, UPDATE, and DELETE statements.

It assumes that SQL itself is written explicitly by developers, and focuses only on the mechanical, repetitive work that surrounds handwritten SQL, keeping the development experience lightweight and centered on SQL.

---

## Features

- DBMS-agnostic by design  
  (tested with PostgreSQL, MySQL, SQL Server, and SQLite)
- Independent of any specific database client or library  
  (tested with node-postgres and Neon)
- SELECT helpers focus on result mapping, not query construction
- Simple builders for common INSERT, UPDATE, and DELETE cases

---

## Philosophy

We treat SELECT queries as direct expressions of domain requirements. Their design, implementation, and debugging should therefore happen in fast, tight feedback loops. In this model, the primary development surface is the SQL client itself, while the IDE plays a supporting role.

Based on this assumption, sql-contract intentionally does not provide query-building features for SELECT statements. Instead, it focuses on the unavoidable, mechanical task that accompanies handwritten SQL: mapping query results into application models.

For INSERT, UPDATE, and DELETE operations, the cost often lies in writing repetitive SQL rather than in expressing domain intent. To address this, sql-contract offers a minimal builder tailored to common cases such as primary-key-based updates.

More complex write operations fall outside the scope of this library and are expected to be expressed as handwritten SQL.

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
  simpleMapPresets,
  type QueryParams,
} from '@rawsql-ts/sql-contract/mapper'

type Customer = {
  customerId: number
  customerName: string
  customerStatus: string
}

async function main() {
  // Prepare an executor that runs SQL and returns rows.
  // sql-contract stays DBMS/driver-agnostic by depending only on this function.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const executor = async (sql: string, params: QueryParams) => {
    const result = await pool.query(sql, params as unknown[])
    return result.rows
  }

  // SELECT (snake_case columns -> typed DTO)
  const mapper = createMapperFromExecutor(executor, simpleMapPresets.pgLike())
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

  // INSERT
  const insertResult = insert('customers', {
    name: 'alice',
    status: 'pending',
  })
  await executor(insertResult.sql, insertResult.params)

  // UPDATE
  const updateResult = update(
    'customers',
    { status: 'active' },
    { id: 42 },
  )
  await executor(updateResult.sql, updateResult.params)

  // DELETE
  const deleteResult = remove('customers', { id: 17 })
  await executor(deleteResult.sql, deleteResult.params)

  await pool.end()
  void rows
}

void main()
```

---

## Design Principles

- **No inference.**  
  Every column and relation is defined explicitly. The package never scans the database, infers foreign keys, or guesses which columns are present. It works only with the SQL you already own.

- **SQL stays visible.**  
  You always pass a concrete query string along with a parameter list. Nothing is hidden, rewritten, or regenerated behind the scenes.

- **No schema state.**  
  Schema knowledge lives outside this package. There is no model registry, no migration lock, and no central schema cache.

- **Executor responsibility.**  
  Differences between database engines (including placeholder styles, type coercion, or runtime features such as RETURNING) remain in the executor that feeds the mapper or in the client that executes the writer output.

- **Explicit non-goals.**  
  Sql-contract does not guess joins, infer primary keys, track schema migrations, or become a query builder. It does not manage transactions, execute statements, or wrap rows for ORM-style lazy loading. Those responsibilities belong elsewhere so this package can stay lightweight.

---

## Database Support, Executors, and Mapping Rules

Sql-contract does not bundle a database driver or assume a specific DBMS.  
Instead, you provide a small amount of wiring up front, and the library operates only on SQL strings, parameter arrays, and row objects.

Before using the mapper or writer helpers, decide the following:

- **Executor**: how SQL is executed and rows are returned
- **Placeholders**: how parameters are written in SQL
- **Mapping rules**:
  - Common rules shared across queries
  - One-time rules applied per query

The sections below outline each responsibility with minimal examples.

---

### Executor: running SQL and returning rows

An executor is a function that receives `(sql, params)` and returns `Row[]`.  
The `params` argument matches the exported `QueryParams` type—either a positional array or a named record—because sql-contract simply forwards whatever the mapper passes.

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
  simpleMapPresets.pgLike(),
)
```

| Preset | Column names | Date coercion | Intended use |
| --- | --- | --- | --- |
| `pgLike()` | `snake_case` -> `camelCase` | enabled | PostgreSQL-style schemas |
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
  simpleMapPresets.pgLike(),
)
```

#### Case B: your client returns an object wrapper

Some clients return objects such as `{ rows }` or `{ recordset }`.  
Normalize this shape once so that sql-contract always sees `Row[]`.

```ts
const mapper = createMapperFromExecutor(
  toRowsExecutor(client, 'query'),
  simpleMapPresets.pgLike(),
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

---

## Mapper: Advanced Usage (R)

Mapping rows back into DTOs is the core mission of sql-contract. The mapper helpers rely on explicit entity definitions (`entity({ name, key, prefix })`, relations, column maps, and guards) to describe how each SQL result should be shaped.

You can hydrate a single model, map multiple models from the same row set, or lazily duck-type results via `simpleMapPresets` and custom coercion hooks. Because the mapper never fabricates column names or guesses relation keys, the resulting domain logic remains transparent and predictable.

If you already handwrite SQL, the mapper is the smallest possible addition: it handles the mechanical task of mapping columns to fields so the rest of your code can stay focused on the intent expressed in SQL.

---

## Influences / Related Ideas

Sql-contract is inspired by minimal mapping libraries such as Dapper and other thin contracts that keep SQL visible while wiring rows to typed results. These projects demonstrate the value of stopping short of a full ORM and instead providing a predictable, testable layer for purely mechanical concerns.

Sql-contract adopts that lesson within the rawsql-ts ecosystem: SQL remains the domain language, and this package automates only the tedious bridging work around it.
