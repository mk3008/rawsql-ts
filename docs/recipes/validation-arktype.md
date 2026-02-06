---
title: Validation recipe (ArkType)
---

# Validation recipe (ArkType)

Selecting ArkType as the runtime validator installs `arktype` so you can validate every DTO using its expressive schema syntax while still executing SQL through `@rawsql-ts/sql-contract`. The runtime hook uses `reader.validator(...)`, so no additional helper package is required beyond `arktype`.

## Install

```bash
pnpm add -D @rawsql-ts/sql-contract arktype
```

## Example snippet

```ts
import { type } from 'arktype';
import { createReader } from '@rawsql-ts/sql-contract/mapper';
import { getSqlClient } from '../support/sql-client-factory';

const executor = async (sql: string, params: readonly unknown[]) => {
  const client = await getSqlClient();
  return client.query(sql, params);
};

const reader = createReader(executor);

const CustomerSchema = type({
  customerId: 'number',
  customerName: 'string',
});

type Customer = ReturnType<typeof CustomerSchema>;

export async function listCustomers(): Promise<Customer[]> {
  return reader
    .validator((value) => {
      CustomerSchema.assert(value);
      return value as Customer;
    })
    .list('SELECT customer_id, customer_name FROM public.user_account', []);
}
```

This validator wraps the ArkType schema, asserts the DTO shape, and returns the typed value so the mapper pipeline remains untouched.

## Related recipes

- Use the SQL contract recipe for the base reader/writer wiring (`docs/recipes/sql-contract.md`).
- The Zod recipe describes the alternate runtime validator (`docs/recipes/validation-zod.md`).
