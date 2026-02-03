# AGENTS: ZTD Test Guidelines

This file defines **rules and boundaries for writing tests under `tests/`**.
Tests are a shared workspace for humans and AI, but must respect ZTD-specific constraints.

---

## Default execution mode (important)

- Tests rely on the generated `SqlClient` contract defined in `src/db/sql-client.ts`.
  `tests/support/testkit-client.ts` is intentionally minimal: wire it to your adapter,
  to a mock, or to a fixture helper before executing repository tests.
- No database adapters are bundled with the template, so plan for one before running
  SQL-backed suites. Usually this means:
  - Setting `DATABASE_URL` (and optionally `ZTD_LINT_DATABASE_URL`/`ZTD_SQL_LOG`) so
    the adapter knows where to connect.
  - Installing a driver adapter such as `@rawsql-ts/adapter-node-pg` or writing a
    custom `SqlClient` implementation when the template is not sufficient.
- Running tests without configuring `tests/support/testkit-client.ts` should fail
  early with a clear message. Update the stub file, inject your factory, and only
  then rerun `pnpm --filter <package> test`.
- `tests/support/global-setup.ts` now warns whenever `DATABASE_URL` is missing so
  you remember to install an adapter or provide a connection before executing
  SQL-backed tests.

---

## Validation tooling recipes

SQL catalog/mapping (`@rawsql-ts/sql-contract`) and runtime DTO validation are always installed. Follow the companion recipes (`docs/recipes/sql-contract.md`, `docs/recipes/validation-zod.md`, `docs/recipes/validation-arktype.md`) instead of duplicating lengthy instructions here. Prefer the Zod recipe when `zod` appears alongside `@rawsql-ts/sql-contract`; otherwise, follow the ArkType recipe when `arktype` is present.

## Use generated types only (important)

- Do **not** define ad-hoc or duplicate test models.
- For table-shaped rows, always import types from:
  - `tests/generated/ztd-row-map.generated.ts`
- For application-facing return values:
  - Use DTO or domain model types already defined in `src/`.

Forbidden example:

```typescript
type CategoryTestRow = {
  category_id: number;
  parent_id: number | null;
  name: string;
};
```

If a required type is missing:
- Regenerate generated artifacts (`npx ztd ztd-config`), or
- Export the correct type from `src/`.

Do not invent substitute models.
- Tests MUST treat `tests/generated/ztd-row-map.generated.ts` as the single source of truth for table-shaped rows.
- If a column exists in the database but not in the row map, the schema is considered outdated until regenerated.

---

## Stateless test design (important)

- ZTD tests are **stateless by design**.
- Do not write tests that depend on state accumulating across multiple repository calls.

Forbidden patterns include:
- Updating the same record in multiple steps and verifying later state
- Calling multiple repository methods assuming earlier calls affected the database

Preferred patterns:
- Verify results returned by a single statement
- Verify `RETURNING` values
- Verify affected row counts
- Verify query output produced by the same call being tested

If behavior depends on transactions, isolation, or shared mutable state:
- That test does not belong in ZTD unit tests.
- Move it to an integration test and explicitly request Traditional mode.
- A single repository method call is the maximum scope of observation in ZTD tests.
- Tests that validate cross-call effects, workflows, or lifecycle transitions do not belong in ZTD tests.

---

## Fixtures (important)

- Fixtures originate from `ztd/ddl/`.
- Keep fixtures minimal and intention-revealing.
- Do not add rows or columns unrelated to the test intent.
- Do not simulate application-side logic in fixtures.
- Fixtures must satisfy non-nullable columns and required constraints derived from DDL.
- Fixtures MUST NOT encode business rules, defaults, or derived values.
- Fixtures exist only to satisfy schema constraints and make SQL executable.

---

## Assertions (important)

- Assert only on relevant fields.
- Do not assert implicit ordering unless the repository contract explicitly guarantees it
  (e.g. the query includes a defined `ORDER BY`).
- Do not assert specific values of auto-generated IDs.
- Assert existence, type, cardinality, or relative differences instead.

---

## Repository boundaries (important)

- Tests should verify observable behavior of repository methods.
- Do not duplicate SQL logic or business rules inside tests.
- Do not test internal helper functions or private implementation details.
- Tests must match the repository method contract exactly
  (return type, nullability, and error behavior).
- Tests MUST NOT compensate for mapper or writer limitations by reimplementing logic in the test itself.

---

## Test helper and resource lifecycle (important)

- Any test helper that creates a client, connection, or testkit instance
  **must guarantee cleanup**.
- Always close resources using `try/finally` or a dedicated helper
  (e.g. `withRepository`).
- Do not rely on test success paths to release resources.

---

## Test file conventions (important)

- Do not assume Vitest globals are available.
- Explicitly import `describe`, `it`, and `expect` from `vitest`
  unless the project explicitly documents global usage.
- Avoid implicit `any` in tests and helpers.
  - Explicitly type fixtures and helper parameters
    (e.g. `Parameters<typeof createTestkitClient>[0]`).

---

## Edit boundaries

- Tests are shared ownership: humans and AI may both edit.
- However:
  - Do not redefine models.
  - Do not change schema assumptions.
- Do not edit `ztd/ddl`. `ztd/ddl` is the only authoritative `ztd` directory; do not create or assume additional `ztd` subdirectories without explicit instruction.
- The only authoritative source for tests is `ztd/ddl`.
- Tests may fail when `ztd/` definitions change; tests MUST be updated to reflect those changes, not the other way around.

---

## Conflict resolution

- If test requirements conflict with ZTD constraints:
  - Stop and ask for clarification.
  - Do not silently switch modes or weaken assertions.

---

## Writer metadata guardrail (template-specific)

- `tests/writer-constraints.test.ts` reads `userAccountWriterColumnSets` together with `tests/generated/ztd-row-map.generated.ts` to ensure every writer column actually exists on `public.user_account`.
- Run `npx ztd ztd-config` before executing the template tests so the generated row map reflects your current schema changes.
- When new columns appear in the writer helpers, adjust `userAccountWriterColumnSets`, rerun the row-map generator, and update the constraint test expectations.
- These tests exist to enforce column correctness at test time so writer helpers remain runtime-safe and schema-agnostic.

## Guiding principle

ZTD tests exist to validate **repository behavior derived from SQL semantics in isolation**.
They are not integration tests, migration tests, or transaction tests.      

Prefer:
- Clear intent
- Single observation point
- Deterministic outcomes
