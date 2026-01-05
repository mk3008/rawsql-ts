# AGENTS: ZTD Test Guidelines

This file defines **rules and boundaries for writing tests under `tests/`**.
Tests are a shared workspace for humans and AI, but must respect ZTD-specific constraints.

---

## Default execution mode (important)

- The default execution mode for tests is **ZTD**.
- Do not switch to Traditional mode unless explicitly instructed by a human.
- Do not set `ZTD_EXECUTION_MODE=traditional` or pass `{ mode: "traditional" }` to `createTestkitClient()` without explicit instruction.
- If instructions are ambiguous, assume ZTD mode and proceed.

---

## Use generated types only (important)

- Do **not** define ad-hoc or duplicate test models.
- For table-shaped rows, always import types from:
  - `tests/generated/ztd-row-map.generated.ts`
- For application-facing return values:
  - Use DTO or domain model types already defined in `src/`.

Forbidden example:

```
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

---

## Assertions (important)

- Assert only on relevant fields.
- Do not assert implicit ordering.
- Do not assert specific values of auto-generated IDs.
- Assert existence, type, or relative differences instead.

---

## Repository boundaries

- Tests should verify observable behavior of repository methods.
- Do not duplicate SQL logic or business rules inside tests.
- Do not test internal helper functions or private implementation details.

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

ZTD tests exist to validate **SQL semantics in isolation**.
They are not integration tests, migration tests, or transaction tests.

Prefer:
- Clear intent
- Single observation point
- Deterministic outcomes
