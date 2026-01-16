# @rawsql-ts/mapper-core

`@rawsql-ts/mapper-core` converts raw SQL result sets into structured DTOs while respecting the column prefixes and explicit column maps emitted by a planner. It operates on the `{ sql, params }` tuple returned by the executor you provide, keeping the mapper itself agnostic to any database, driver, or CLI framework.

This package sticks to read-only transformation: it only consumes `Record<string, unknown>` rows and defers SQL, DDL, RowMaps, `Table`, or `Entity` concerns to callers. The intent is to keep the mapper core small, explicit, and incapable of accumulating ORM or schema knowledge.

## High-level behavior

The implementation reflects the guardrails defined in `packages/mapper-core/AGENTS.md`, but this README keeps the focus on what users can rely on and how they override any defaults.

- **Column normalization remains mechanical.** Columns are treated case-insensitively and normalized with `snake_to_camel` by default. If two columns normalize to the same property name, the mapper throws immediately—there is no automatic winner. Fix the SQL (add an alias) or opt out of normalization for that query by passing `{ keyTransform: 'none' }`.
- **Identifiers are strings unless you say otherwise.** Properties named `id` or camelCase ending in `Id` are converted to strings when `idKeysAsString` is `true` (the default) so DTOs stay JSON-safe even if the database returns `bigint` PKs. Names that do not follow the camelCase `*Id` shape—such as `userid`, `grid`, or `identity`—remain untouched. To keep a column as `bigint` (or another type), add a matching `typeHints` entry, set `idKeysAsString: false` for that query, or stringify/`BigInt()` it downstream.
- **There is no hidden type guessing.** Date and timestamp strings only become `Date` objects when you opt in via `coerceDates` or provide a `typeHints` map. The `typeHints` entries refer to the DTO property names after normalization, run before identifier stringification, and currently accept `'string' | 'number' | 'boolean' | 'date' | 'bigint'`. Once you declare a hint, it always wins over other defaults.
- **Override order is explicit.** The precedence is `typeHints > query options > mapper defaults > built-in defaults`. Every query can override the defaults you configured when building the mapper, so explicit settings always take priority.
- **No fallbacks, no guessing.** Optional relations only relax the requirement on the row value (`null`/`undefined` is allowed) but still require the columns to exist. The mapper never infers missing columns, does not try alternative names, and never silently overwrites data.

## Recommended usage

```ts
import {
  createMapperFromExecutor,
  simpleMapPresets,
  toRowsExecutor,
  entity,
} from '@rawsql-ts/mapper-core'

const mapper = createMapperFromExecutor(
  toRowsExecutor(pgClient, 'query'),
  simpleMapPresets.safe()
)

const invoices = await mapper.query<Invoice>('SELECT ...', [id])
```

`createMapperFromExecutor` keeps the defaults contract explicit (`keyTransform`, `coerceDates`, `coerceFn`, `idKeysAsString`, `typeHints`), while `createMapper` remains available for minimalist setups. Default coercion runs before any `coerceFn` and the mapper always throws on camelCase collisions.

## Minimal usage

```ts
import { createMapper, entity } from '@rawsql-ts/mapper-core'

const executor = async (sql: string, params: unknown[]) => {
  // use pg client, sqlite, or any fetcher that returns rows
  return pgClient.query(sql, params)
}

const order = entity({ name: 'Order', key: 'id', prefix: 'order_' })
const item = entity({ name: 'Item', key: 'id', prefix: 'item_' })
  .belongsToWithLocalKey('order', order, 'orderId')

const mapper = createMapper(executor)
const rows = await mapper.query(sql, params, item)
```

## Identifier handling & type hints

`SimpleMapOptions` exposes `keyTransform`, `coerceDates`, `coerceFn`, `idKeysAsString`, and a `typeHints` map. The explicit hints refer to the DTO property names after normalization and currently accept `'string'`, `'number'`, `'boolean'`, `'date'`, and `'bigint'`. Because hints run before the identifier guard and before `coerceFn`, you can keep `id` as `bigint`, parse `createdAt` into a `Date`, or treat `activeFlag` as a boolean even when `idKeysAsString` stays `true`.

```ts
const rows = await mapper.query<MyDto>(sql, params, {
  keyTransform: 'snake_to_camel',
  typeHints: {
    id: 'bigint',
    createdAt: 'date',
  },
})
```

When no hint matches, identifier stringification still runs by default so camelCase `*Id` properties turn into strings for JSON safety. Names such as `userid`, `grid`, or `identity` are intentionally excluded because they do not follow the camelCase `*Id` shape. If you need the raw numeric type, either add a `typeHints` entry, set `idKeysAsString: false` for that query, or convert it manually (`const id = BigInt(dto.id)`).

## Optional relationships & strict failure

- Columns for required keys must exist; missing columns throw. Optional parents only allow rows where the column is present but the value is `null`/`undefined`, they do not skip validation when the column itself is absent.
- Duplicate normalized columns throw; add SQL aliases or opt out of normalization with `keyTransform: 'none'` per query.
- There is no attempt to guess alternative column names or to overwrite values silently. If behavior is unclear, the mapper raises an error so the SQL can be fixed explicitly.

## Explicit presets

`simpleMapPresets` gives named bundles that do not rely on inference:

- `simpleMapPresets.safe()` disables key transforms, date coercion, and identifier stringification so you can work with driver-provided casing.
- `simpleMapPresets.pgLike()` enables the default snake_case → camelCase mapping and ISO date coercion; it is not Postgres-specific.

| Preset | keyTransform | coerceDates | Notes |
|--------|--------------|-------------|-------|
| `safe` | `none` | `false` | Keeps column casing as-is and avoids coercion for driver raw DTOs. |
| `pgLike` | `snake_to_camel` | `true` | General snake_case to camelCase mapping with ISO date coercion. |

## Explicit helpers

Use helpers to reduce boilerplate without introducing hidden inference:

```ts
import { columnMapFromPrefix, entity } from '@rawsql-ts/mapper-core'

const country = entity({
  name: 'Country',
  key: 'id',
  columnMap: columnMapFromPrefix('country_', ['id', 'name']),
})
```

```ts
const item = entity({ name: 'Item', key: 'id', prefix: 'item_' })
  .belongsToWithLocalKey('order', order, 'orderId')
  .belongsToOptional('product', product, 'productId')
```

All relations now require explicit local keys. Prefer `belongsToWithLocalKey` for required parents and `belongsToOptional` for optional parents; both work with column map aliases so no naming inference is needed.

`localKey` refers to the column that carries the relation reference and guards optional hydration; the parent entity itself still resolves through the parent's key column so `localKey` only affects column validation.

## Strict simple mapping

If you need zero implicit key normalization, opt in explicitly:

```ts
const mapper = createMapper(executor, { keyTransform: 'none' })
```
