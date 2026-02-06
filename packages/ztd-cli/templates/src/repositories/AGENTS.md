# src/repositories AGENTS

This directory contains repository implementations.

## Runtime classification

- This is a runtime directory.
- Code here is executed by the application.

## Responsibilities

Repositories orchestrate execution only.

They are responsible for:
- calling catalog entries (QuerySpec) through a shared catalog executor
- validating external inputs via catalog boundary contracts
- binding parameters for catalog execution
- handling rowCount-based command outcomes at the boundary
- returning application-facing results

Repositories MUST remain thin adapters over catalog contracts.

Repositories MUST NOT:
- load SQL text or SQL file paths
- call SQL loaders directly (for example `loadSql`)
- embed business rules
- infer schema or DTO structure
- compensate for driver limitations with extra queries

## Contract boundaries (important)

- Human-owned contracts live under "src/catalog/specs".
- Runtime normalization and validation live under "src/catalog/runtime".
- Repositories MUST NOT invent, infer, or modify contracts.

If a contract is insufficient, update the spec/runtime first.

## Mandatory catalog usage (required)

Repositories MUST execute via catalog entries and shared executor wiring.

Repositories MUST:
- reference stable catalog entry identity (`specId` and/or typed spec object)
- delegate mapping/validation to catalog entries and catalog runtime helpers

Repositories MUST NOT:
- duplicate row-to-DTO mapping logic in repository methods
- bypass catalog parameter/output validation
- assume driver-specific runtime types (e.g. timestamps always `Date`)

## SQL rules

- SQL assets MUST remain DTO-independent.
- SQL files MUST use snake_case column names.
- Repositories MUST NOT push DTO aliasing into SQL.
- Inline SQL strings are forbidden.
- SQL logical keys (example: `user/insert_user.sql`) MUST be owned by catalog entries.
- Repository modules MUST NOT implement ad-hoc SQL loading with `readFileSync`, `__dirname`, `import.meta.url`, or direct path resolution.

## CUD default policy (important)

Default policy for table-oriented CUD is:
- CREATE SQL MAY use `RETURNING` for identifier columns only.
- CREATE repository methods MUST return the generated identifier by default.
- CREATE repository methods MUST NOT perform a follow-up SELECT whose purpose is DTO return shaping.
- UPDATE/DELETE SQL MUST NOT use `RETURNING`.
- repositories do NOT perform follow-up SELECTs after UPDATE/DELETE.
- UPDATE/DELETE methods return `Promise<void>` by default.

If a CREATE method must return a DTO, that requirement MUST be explicitly declared in catalog specs by human instruction.

## CUD row count rules (non-negotiable)

- UPDATE and DELETE MUST rely on driver-reported affected row counts (`rowCount` or equivalent).
- Repositories MUST NOT use SQL `RETURNING` result presence/count as a substitute for affected row counts.
- Repositories MUST NOT emulate affected rows using:
  - pre-check SELECT
  - post-check SELECT
  - retry loops
  - shadow queries / CTE hacks

If `rowCount === 0`, repositories MUST throw an explicit error.

If the driver cannot report affected row counts:
- CUD verification is unsupported
- tests MUST fail fast
- do NOT add workaround logic in repositories

## Read (SELECT) rules

- SELECT methods may return:
  - `T | null` for single-row queries
  - `T[]` for multi-row queries
- Absence of rows is NOT an error unless specified by the contract.

## Error behavior

- Propagate validation errors as failures.
- Do not silently coerce invalid data.
- Error messages SHOULD include operation name and identifying parameters.

## Testing expectations

- Every public repository method MUST be covered by tests.
- Update/Delete tests MUST verify rowCount handling explicitly.
- Repository changes without tests are incomplete.

## Guiding principle

Repositories execute contracts.
They do not interpret intent.

If correctness depends on extra queries to "confirm" changes:
- the contract is wrong
- or the driver is unsupported

Fix the contract, not the repository.
