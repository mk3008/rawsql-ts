---
title: SQL-first End-to-End Tutorial
outline: deep
---

# SQL-first End-to-End Tutorial

This tutorial shows the shortest path from DDL to the first passing test.

It walks the sequence `DDL -> SQL -> ztd-config -> model-gen -> repository wiring -> first test` with one table, one SQL asset, one repository seam, and one smoke test.

It uses one table, one SQL asset, one repository seam, and one smoke test. The sequence stays aligned with the first-success path established by `ztd init`, `ztd-config`, `model-gen`, and `npm run test`.

## What you will build

- `ztd/ddl/public.sql`
- `src/sql/users/list_active_users.sql`
- `src/catalog/specs/users/list_active_users.spec.ts`
- `src/repositories/users/list-active-users.ts`
- `tests/smoke.test.ts`

## 1. Scaffold the project

Start from a new project, install the CLI, and scaffold the default layout:

```bash
npm init -y
npm install -D @rawsql-ts/ztd-cli vitest typescript
npx ztd init --yes --workflow empty --validator zod
```

After `ztd init`, keep the generated `README.md`, `tests/`, `src/sql/`, and `src/repositories/` folders in place. This tutorial assumes the default scaffold so the repository seam stays simple and visible.

## 2. Add one table

Put the source of truth in `ztd/ddl/public.sql`:

```sql
create table public.users (
  id integer primary key,
  email text not null,
  active boolean not null
);
```

Keep the DDL intentionally small. The goal is to prove the lifecycle, not to design a complete schema.

## 3. Add one SQL asset

Create `src/sql/users/list_active_users.sql`:

```sql
select
  id,
  email
from public.users
where active = :active
order by id
```

This keeps the handwritten SQL on the source-asset side of the boundary while the repository stays focused on orchestration.

## 4. Regenerate the DDL-backed contract

Run:

```bash
npx ztd ztd-config
```

This refreshes the generated `TestRowMap` and layout metadata from the DDL snapshot. If this step fails, fix the schema first before moving on.

## 5. Generate the QuerySpec scaffold

Run:

```bash
npx ztd model-gen src/sql/users/list_active_users.sql --probe-mode ztd --out src/catalog/specs/users/list_active_users.spec.ts
```

The generated file should stay under `src/catalog/specs/`. Review the resulting row mapping, nullability, and example values before treating it as ready.

## 6. Wire the repository seam

Create a small repository wrapper in `src/repositories/users/list-active-users.ts`.

Keep the wrapper responsible for:

- importing the generated QuerySpec scaffold
- calling the SQL client or adapter boundary
- hiding the SQL asset path from the rest of the app

Keep the wrapper intentionally thin. The repository should not own DDL or query-shape generation; it should only connect the generated spec to the runtime seam.

## 7. Keep the first test green

Update or create the first smoke test in `tests/smoke.test.ts`.

Use the test to prove that the repository seam is importable and that the scaffold still reaches a passing first test before any deeper integration work is added.

Example:

```ts
import { expect, test } from 'vitest';
import { listActiveUsers } from '../src/repositories/users/list-active-users';

test('first smoke test', () => {
  expect(listActiveUsers).toBeTypeOf('function');
});
```

Run the first test with:

```bash
npm run test
```

This is the first test, not the full integration suite. It proves the consumer path can reach visible value before you add DB-backed coverage.

## What to do next

- Expand the repository seam only after the first smoke test is green.
- Add stronger SQL-backed coverage when the lifecycle needs it.
- Re-run `npx ztd ztd-config` whenever the DDL changes.
- Re-run `npx ztd model-gen` whenever the SQL asset changes.

The tutorial is intentionally small so the first successful loop stays easy to understand and easy to repeat.
