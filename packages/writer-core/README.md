# @rawsql-ts/writer-core

writer-core exposes the smallest possible helpers for writing CUD statements while keeping SQL strings and params visible. It does not carry schema metadata, row maps, or DDL-like DSLs so you can keep the raw SQL canonical in your tests.

## Purpose

- Provide `insert`, `update`, and the optional `remove` helpers that accept a table name and plain value record, and return `{ sql, params }`.
- Ensure `undefined` values are skipped so CUD statements stay concise.
- Leave WHERE clauses to the caller so writer-core never interprets schema relationships, joins, or automatic diff tracking.

## Example

```ts
import { insert, update, remove } from '@rawsql-ts/writer-core'

const insertResult = insert('users', { name: 'Ztd User', email: 'ztd@example.com', bio: undefined })
// insertResult.sql -> "INSERT INTO users (name, email) VALUES ($1, $2)"

const updateResult = update('users', { name: 'Better Name' }, { id: 3 })
// updateResult.sql -> "UPDATE users SET name = $1 WHERE id = $2"

const deleteResult = remove('users', { id: 3 })
// deleteResult.sql -> "DELETE FROM users WHERE id = $1"
```

## Why this is not an ORM or DSL

ORMs slide schema, entities, and DDL descriptions into application code, which conflicts with ZTD expectations where the single source of truth for schema lives in DDL fixtures. writer-core deliberately refuses to become a *model* — it only helps you shorten the repetitive SQL column listing that otherwise comes with CUD statements.

It also avoids any DSL that tries to describe tables, columns, or joins. WHERE clauses are limited to simple equality AND conditions so the API stays small; anything more complex should be resolved in the surrounding script. Table and column identifiers must be application constants and never derived directly from user input—the package does not validate identifiers by design. That design keeps the database grammar isolated in the tests and fixtures, so rawsql-ts stays faithful to the Zero Table Dependency philosophy: SQL and schema lives in your DDL tests, not in runtime TypeScript models.

## ParamValue guidance

`ParamValue` documents the common types expected in `params` so callers know what is idiomatic, but writer-core does not coerce or validate values beyond skipping `undefined`.
