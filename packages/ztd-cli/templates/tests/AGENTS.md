# AGENTS: ZTD Test Guidelines

This file defines **rules and boundaries for writing tests under `tests/`**.
Tests are a shared workspace for humans and AI, but must respect ZTD-specific constraints.

---

## Default execution mode (important)

- The default execution mode for tests is **ZTD**.
- ZTD tests run through the new `createTestkitProvider` helper, which keeps a single
  shared backend connection per worker and wraps each scenario in a rollback
  transaction by default.
- Do not switch to Traditional mode unless explicitly instructed by a human.
- Do not set `ZTD_EXECUTION_MODE=traditional` or pass `{ mode: "traditional" }` to `createTestkitClient()` without explicit instruction.
- When you need session-level changes (temporary tables, `SET` commands, etc.), opt
  into per-test isolation via `provider.perTest()` or by passing `{ strategy:
  'perTest' }` to `provider.withRepositoryFixture`. Shared mode otherwise keeps the
  default behavior fast and deterministic.
- If instructions are ambiguous, assume ZTD mode and proceed.

---

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

---

## Fixtures (important)

- Fixtures originate from `ztd/ddl/`.
- Keep fixtures minimal and intention-revealing.
- Do not add rows or columns unrelated to the test intent.
- Do not simulate application-side logic in fixtures.
- Fixtures must satisfy non-nullable columns and required constraints derived from DDL.

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
  - Do not edit `ztd/ddl`, `ztd/domain-specs`, or `ztd/enums` from tests.

---

## Conflict resolution

- If test requirements conflict with ZTD constraints:
  - Stop and ask for clarification.
  - Do not silently switch modes or weaken assertions.

---

## Guiding principle

ZTD tests exist to validate **repository behavior derived from SQL semantics in isolation**.
They are not integration tests, migration tests, or transaction tests.

Prefer:
- Clear intent
- Single observation point
- Deterministic outcomes
