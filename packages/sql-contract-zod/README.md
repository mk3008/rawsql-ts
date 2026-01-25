# @rawsql-ts/sql-contract-zod

## Overview

`sql-contract-zod` layers Zod-based runtime validation on top of the explicit mapper helpers from `sql-contract-core`. The base package keeps SQL authoritative and mapping deterministic; this edition adds an opt-in runtime guard so that DTOs remain fully validated (and optionally transformed) before they reach the rest of the application.

- **Runtime vs compile time:** TypeScript types are only compile-time hints. Always validate driver rows with a Zod schema before using them.
- **No inference:** All validation/coercion is explicit. `sql-contract-zod` never guesses column names or silently converts values.
- **Composes with any mapper or row mapping:** Use existing `rowMapping` definitions, mapper executors, and mapper options to project rows before validation.

## Installation

```sh
pnpm add @rawsql-ts/sql-contract-zod zod
```

> The package depends on `@rawsql-ts/sql-contract-core` for the mapper helper primitives.

## Runtime validation helpers

### Strict validation

```ts
import { z } from 'zod'
import { queryZod } from '@rawsql-ts/sql-contract-zod'
import { createMapperFromExecutor } from '@rawsql-ts/sql-contract-core/mapper'

const CustomerRow = z.object({
  customerId: z.number(),
  customerName: z.string(),
})

const mapper = createMapperFromExecutor(executor)
const rows = await queryZod(
  mapper,
  CustomerRow,
  'select customer_id as customerId, customer_name as customerName from customers'
)
```

`queryZod` validates every row returned by the mapper. If any row violates the schema, the function rethrows the `ZodError` so that the failure remains visible to the caller.

You no longer need to pass `undefined` when skipping the optional parameters—you can call `queryZod(mapper, schema, sql)` or `queryZod(mapper, schema, sql, mapping)` and the helper automatically figures out whether the fourth argument is a params array or a `RowMapping`.

### Explicit coercion helpers

Use the helper schemas when the driver sometimes returns numbers as strings or dates as ISO strings. Each conversion is opt-in per field.

```ts
import { z } from 'zod'
import { zNumberFromString, queryZod } from '@rawsql-ts/sql-contract-zod'

const InvoiceRow = z.object({
  invoiceId: z.number(),
  amount: zNumberFromString,
})
```

If the driver returns `{ amount: '33' }`, the helper trims and parses the string before validating it as a number.

### Mapping-aware validation

```ts
import { rowMapping, createMapperFromExecutor } from '@rawsql-ts/sql-contract-core/mapper'
import { queryZod } from '@rawsql-ts/sql-contract-zod'

const mapping = rowMapping({
  name: 'Invoice',
  key: 'invoiceId',
  columnMap: {
    invoiceId: 'invoice_id',
    total: 'invoice_total',
  },
})

const schema = z.object({
  invoiceId: z.number(),
  total: zNumberFromString,
})

const rows = await queryZod(
  mapper,
  schema,
  'select * from invoices',
  mapping
)
```

`queryZod` accepts the same `RowMapping` instance that your mapper already uses, so you can validate DTOs after mapping but before business logic consumes them.

## Additional helpers

- `queryOneZod` mirrors `queryZod` but returns exactly one row and throws if the query returns nothing.
- `parseRows` / `parseRow` let you validate data that was already mapped by `sql-contract` or fetched from another source.
- `zBigIntFromString` and `zDateFromString` provide explicit transforms for common driver mismatches.

All helpers throw their original `ZodError` so your logging, monitoring, or error-handling layers can inspect the full issue set.
