# ztd-playground AGENTS

This playground exists to validate the ZTD development loop end-to-end against a real Postgres connection without creating physical tables. Follow these rules when working inside this package.

## 1. Use the Postgres testkit helper
- Always wire Postgres execution through `tests/test-utils.ts`, which opens a `pg.Client`, passes it into `@rawsql-ts/pg-testkit`, and shares the connection across tests.
- Set `DATABASE_URL` before running `pnpm playground:test` (or any spec that touches the helper); the helper throws a clear error when it is missing.
- Never issue DDL statements against Postgres from the playground. All CRUD operations must flow through pg-testkit so they resolve to fixture-backed `SELECT` queries.

## 2. Treat `ddl/schemas` as the single source of truth
- Keep every table definition inside `ddl/schemas/*.sql`.
- Do not hand-edit `ztd-config.ts`; regenerate it with:

```bash
pnpm --filter ztd-playground exec ztd ztd-config
```

## 3. `ztd-config.ts` defines typed fixtures
- Import `ZtdConfig`, `ZtdRowShapes`, `ZtdTableName`, and `tableFixture()` from the generated file.
- Trust the generated helpers for row shapes instead of duplicating row interfaces inside tests.

## 4. Keep tests deterministic
- Provide explicit fixtures for each test:

```ts
tableFixture('schema.table', [{ ... }])
```

- Do not reuse shared mutable data between tests.
- Do not insert, update, or delete data directly; rely on the rewrite helper instead.

## 5. Keep the playground minimal
- Only include:
  - DDL files
  - minimal SQL examples in `src/`
  - ZTD-focused tests under `tests/`
- Avoid adding application logic, persistence layers, or business services.
