---
title: SQL catalog & mapping recipe
---

# SQL catalog & mapping recipe

When `ztd init` enables runtime validation, it always installs `@rawsql-ts/sql-contract` so you can map raw SQL rows into DTOs without duplicating column metadata.

## Install

```bash
pnpm add -D @rawsql-ts/sql-contract
```

## What to wire

- Use `createReader` (and `createWriter` when you need CUD helpers) to wrap the executor that appears in `tests/support/testkit-client.ts`.
- Bind domain-specific `rowMapping` definitions to the reader so DTO shapes stay explicit and reusable.
- Refer to `tests/generated/ztd-row-map.generated.ts` for authoritative row types and `src/repositories/*` for repository contracts.

### Example (`tests/support/testkit-client.ts`)

```ts
import type { SqlClient } from '../../src/db/sql-client';
import { createReader } from '@rawsql-ts/sql-contract/mapper';
import { rowMapping } from '@rawsql-ts/sql-contract/mapper';
import { getSqlClient } from '../support/sql-client-factory';

const executor = async (sql: string, params: readonly unknown[]) => {
  const client: SqlClient = await getSqlClient();
  const rows = await client.query(sql, params);
  return rows;
};

const userMapping = rowMapping({
  name: 'UserProfile',
  key: 'userAccountId',
  columnMap: {
    userAccountId: 'user_account_id',
    displayName: 'display_name',
  },
});

const reader = createReader(executor);

export async function listUserProfiles() {
  return reader.bind(userMapping).list(
    'SELECT user_account_id, display_name FROM public.user_account',
    []
  );
}
```

The reader above can be used directly in tests or shared helpers so the same SQL, mapping, and fixtures power every suite.

## What’s next

- Wire runtime validation by following either the Zod or ArkType recipe below. Validation is required for every ZTD project, so keep your chosen validator aligned with the reader/writer wiring.
