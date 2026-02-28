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

## Catalog executor patterns

If your project keeps SQL in files, it helps to centralize the file-backed loader
once instead of repeating `readFile(resolve(...))` in every repository:

```ts
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogExecutor, rowMapping, type QuerySpec } from '@rawsql-ts/sql-contract';

function createFileSqlLoader(baseDir: string) {
  return {
    load(sqlFile: string) {
      return readFile(resolve(baseDir, sqlFile), 'utf8');
    },
  };
}

const sqlDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../sql'
);

const catalog = createCatalogExecutor({
  loader: createFileSqlLoader(sqlDirectory),
  executor,
});
```

When `output.mapping` is present, `output.validate` receives the mapped DTO, not
the raw SQL row. This keeps validation focused on the application contract:

```ts
const userProfileSpec: QuerySpec<[string], { userId: string; displayName: string }> = {
  id: 'user-profile.by-id',
  sqlFile: 'user-profile/by-id.sql',
  params: { shape: 'positional', example: ['user-1'] },
  output: {
    mapping: rowMapping({
      name: 'UserProfile',
      key: 'userId',
      columnMap: {
        userId: 'user_id',
        displayName: 'display_name',
      },
    }),
    validate: (value) => ({
      userId: String((value as { userId: unknown }).userId),
      displayName: String((value as { displayName: unknown }).displayName),
    }),
    example: {
      userId: 'user-1',
      displayName: 'Alice',
    },
  },
};
```

For `count(*)` or `RETURNING id` queries, prefer `catalog.scalar(...)` with a
scalar validator instead of introducing a one-field DTO solely for the contract:

```ts
const touchedThreadSpec: QuerySpec<[string], string> = {
  id: 'thread.touch',
  sqlFile: 'thread/touch.sql',
  params: { shape: 'positional', example: ['thread-1'] },
  output: {
    validate: (value) => String(value),
    example: 'thread-1',
  },
};

const threadId = await catalog.scalar(touchedThreadSpec, ['thread-1']);
```

## What’s next

- Wire runtime validation by following the [Zod](./validation-zod.md) or [ArkType](./validation-arktype.md) recipe. Validation is required for every ZTD project, so keep your chosen validator aligned with the reader/writer wiring.
