# ztd-playground AGENTS

This playground exists to validate the ZTD development loop end-to-end against a real Postgres connection without creating physical tables. Follow these rules when working inside this package.

## 1. Use the Postgres testkit helper
- Always wire Postgres execution through `tests/testkit-client.ts`, which opens a `pg.Client`, passes it into `@rawsql-ts/pg-testkit`, and shares the connection across tests. Regenerate the helper with `pnpm playground:gen-config` if you need to move SQL directories or change connection defaults.
- Set `DATABASE_URL` before running `pnpm playground:test` (or any spec that touches the helper); the helper throws a clear error when it is missing.
- Never issue DDL statements against Postgres from the playground. All CRUD operations must flow through pg-testkit so they resolve to fixture-backed `SELECT` queries.

## 2. Treat the ZTD layout as the single source of truth
- Keep every table definition inside `ztd/ddl/<schema>.sql`, enums under `ztd/enums/*.sql`, and executable specs inside `ztd/domain-specs/*.sql`.
- Do not hand-edit `tests/ztd-layout.generated.ts`; regenerate it with `pnpm playground:gen-config` (or `pnpm --filter ztd-playground exec ztd ztd-config`) so the CLI and tests stay aligned. The row map lives in `tests/ztd-row-map.generated.ts`, which is the canonical place to import fixtures from.

## 3. `tests/ztd-row-map.generated.ts` defines typed fixtures
- Import `ZtdConfig`, `ZtdRowShapes`, `ZtdTableName`, and `tableFixture()` from `tests/ztd-row-map.generated.ts`.
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

## 6. Formatting and linting
- Use `pnpm format` to normalize TypeScript, SQL, Markdown, and config files; do not hand-edit whitespace or indentation.
- Run `pnpm lint` regularly and `pnpm lint:fix` when ESLint reports autofixable issues; these scripts are the single source of truth for formatting/linting.
- The `simple-git-hooks` pre-commit hook triggers `lint-staged`, so staged files already run through `pnpm format` before commits land.
