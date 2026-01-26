# @rawsql-ts/sql-contract-zod

## Overview

`sql-contract-zod` mirrors the structure of `@rawsql-ts/sql-contract` while adding runtime validation on top of the mapper helpers. SQL remains hand-authored, row mappings stay deterministic, and then Zod schemas guard the DTOs before they reach the rest of the application.

- **SQL stays executable.** Queries are still written directly in SQL, executed through your mapper/executor pipeline.
- **Mapping is explicit.** `rowMapping` definitions control how columns become properties, and the mapper never infers semantics.
- **Validation is opt-in.** Schema checks run only when you call the Zod helpers, keeping performance predictable.

## Features

* Zod-based runtimes for mapper output (`queryZod`, `queryOneZod`, `parseRows`, `parseRow`).
* Optional coercion helpers (`zNumberFromString`, `zBigIntFromString`, `zDateFromString`).
* Overloads that accept the same `RowMapping` instances your mapper already uses.
* Params normalization: omitting params is treated the same as passing `[]`, so executors can rely on `unknown[]`.
* Throws the original `ZodError`, keeping your logging/monitoring layers intact.

## Philosophy

`sql-contract-zod` follows the same four commitments as `sql-contract`:

1. **SQL remains the domain language.** All queries stay human-written and executable.
2. **Mapping is mechanical.** DTO projection happens through configured row mappings, not inference.
3. **Validation is deliberate.** Zod schemas guard DTOs after mapping, never before.
4. **Runtime safety complements TypeScript.** Compile-time hints stay lightweight while validation runs only when you explicitly request it.

Validation helpers never guess column names or mutate objects outside the schema definition, keeping the feedback loop predictable.

## Getting Started

### Installation

```sh
pnpm add @rawsql-ts/sql-contract-zod zod
```

`sql-contract-zod` depends on `@rawsql-ts/sql-contract` for the mapper helper primitives.

### Minimal validation sample

```ts
import { z } from 'zod'
import { queryZod, zNumberFromString } from '@rawsql-ts/sql-contract-zod'
import { rowMapping, createMapperFromExecutor } from '@rawsql-ts/sql-contract/mapper'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
  balance: zNumberFromString,
})

const customerMapping = rowMapping({
  name: 'Customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_id',
    customerName: 'customer_name',
    balance: 'balance',
  },
})

const rows = await queryZod(
  mapper,
  CustomerSchema,
  'select customer_id, customer_name, balance from customers where active = true',
  customerMapping,
)
```

The Zod helpers accept the same `RowMapping` your mapper already uses, so you can revalidate DTOs after mapping but before business logic consumes them.

## Executor guidance

Each executor still receives `(sql, params, mapping?)` and returns `Row[]`. Because the helpers normalize omitted params to `[]`, treat the `params` argument as `unknown[]` and skip defensive `undefined` checks.

```ts
async function executor(
  sql: string,
  params: unknown[],
  mapping?: RowMapping<unknown>,
) { ... }
```

`queryZod` figures out whether the optional arguments represent params arrays or `RowMapping` instances, so call sites stay succinct.

## Helpers table

| Helper | Description |
| ------ | ----------- |
| `queryZod` | Validates every dto produced by a mapper query, rethrowing `ZodError` when violations occur. |
| `queryOneZod` | Same as `queryZod` but requires exactly one row. |
| `parseRows` / `parseRow` | Validate DTOs that have already been mapped or came from another source. |
| `zNumberFromString` | Accepts numbers or numeric strings (trims and parses before validation). |
| `zBigIntFromString` | Accepts bigints or strings, trimming and parsing safely. |
| `zDateFromString` | Ensures `Date` objects or ISO strings become valid `Date` instances. |

All helpers propagate the original `ZodError` so monitoring layers can inspect the full issue set.

## Notes

`sql-contract-zod` reuses the mapper presets, row mappings, and mapper options from the base package. Validation runs after mapping, meaning you can keep shared `rowMapping` definitions and layer Zod schemas on top as needed.
