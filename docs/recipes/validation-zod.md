---
title: Validation recipe (Zod)
---

# Validation recipe (Zod)

ZTD init always selects a validator backend. When Zod is chosen, you can wire schemas through `@rawsql-ts/sql-contract` without additional helpers.

## Install

```bash
pnpm add -D @rawsql-ts/sql-contract zod
```

`@rawsql-ts/sql-contract` exposes `reader.validator`, which accepts Zod schemas because they implement `parse(value)` (see `ReaderValidatorInput`). For convenience you can still install `@rawsql-ts/sql-contract-zod` if you want the `reader.zod` helper and numeric coercion helpers described in its README, but the base stack only requires `zod`.

## Example snippet

```ts
import { z } from 'zod';
import { createReader } from '@rawsql-ts/sql-contract/mapper';
import { getSqlClient } from '../support/sql-client-factory';

const executor = async (sql: string, params: readonly unknown[]) => {
  const client = await getSqlClient();
  return client.query(sql, params);
};

const reader = createReader(executor);

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
});

export async function listCustomers() {
  return reader.validator(CustomerSchema).list(
    'SELECT customer_id, customer_name FROM public.user_account',
    []
  );
}
```

Zod validation runs after the mapper binds every row to the DTO, so schema errors surface before tests rely on the result shape.

## Optional helper: @rawsql-ts/sql-contract-zod

`@rawsql-ts/sql-contract-zod` depends on the core mapper and adds the `mapper.zod` helper plus Zod-aware coercion helpers such as `zNumberFromString`. Install it only if you prefer those dedicated APIs; `@rawsql-ts/sql-contract` plus `zod` covers the required validator flow.
