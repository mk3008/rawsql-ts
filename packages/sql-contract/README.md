# @rawsql-ts/sql-contract

`@rawsql-ts/sql-contract` is the explicit contract that sits between human-authored SQL and the application layer. It never invents tables, DDL, or schema metadata; instead it provides:

- a **mapper** that turns `{ sql, params }` results into explicit DTOs while honoring prefixes, column maps, and column normalization policies, and
- a **writer** that emits sanitized `INSERT`, `UPDATE`, and `DELETE` statements plus their parameter lists without ever guessing column names or query intent.

All schema knowledge, SQL, and planning stays outside this package. The mapper and writer helpers treat SQL rows as plain data, respect ASCII identifier checks, and refuse to become an ORM or a-query builder.

## Mapper helpers

Use `createMapper`, `createMapperFromExecutor`, `mapRows`, and `mapSimpleRows` to hydrate typed DTOs from driver rows. Entity mappings are mechanical; prefixes, explicit column maps, and `belongsTo*` relations define every column. The mapper never infers missing columns, hides SQL, or guesses relation keys.

```ts
import {
  createMapper,
  entity,
  simpleMapPresets,
} from '@rawsql-ts/sql-contract/mapper'

const order = entity({ name: 'Order', key: 'id', prefix: 'order_' })
const item = entity({ name: 'Item', key: 'id', prefix: 'item_' })
  .belongsToWithLocalKey('order', order, 'orderId')

const mapper = createMapper(async () => rows, simpleMapPresets.pgLike())
const invoices = await mapper.query(orderSql, [])
```

The mapper exposes the same strict APIs as before: explicit column normalization, optional relation guards, identifier stringification, and configurable coercion (via `coerceDates`, `typeHints`, or custom `coerceFn`).

## Writer helpers

`insert`, `update`, and `remove` accept a table name plus plain column/key objects and return `{ sql, params }`. Undefined values are dropped, identifiers are validated against ASCII-safe patterns unless the caller opts into `allowUnsafeIdentifiers`, and WHERE clauses are limited to equality-only AND lists.

```ts
import { insert, update } from '@rawsql-ts/sql-contract/writer'

const insertResult = insert('customers', {
  name: 'alice',
  nickname: undefined,
})

const updateResult = update(
  'customers',
  { status: 'active' },
  { id: 42 },
)
```

This package deliberately refuses to guess JOINs, infer columns, or add schema metadata. It keeps SQL visible and focuses on exposing a lightweight contract for clients and planners.

The writer helpers now accept an optional `returning?: readonly string[] | 'all'` option. When provided, the generated SQL is extended with a `RETURNING` clause (`'all'` maps to `RETURNING *`, otherwise the column list is sorted alphabetically). Because the writer only emits SQL, it does not verify backend support for `RETURNING`, so unsupported databases may raise an execution error.

## Export surface

Besides the top-level exports (mapper defaults plus the writer helpers), you can import the submodules directly:

- `@rawsql-ts/sql-contract/mapper` for mapper-specific types and helpers.
- `@rawsql-ts/sql-contract/writer` for the `insert`/`update`/`remove` helpers.

Every export is a thin wrapper around the former `mapper-core` and `writer-core` implementations, so no new runtime behavior is introduced.
