# src/repositories/tables AGENTS

This directory contains simple CRUD-style repositories.

## Runtime classification

- This is a runtime directory.
- Code here executes SQL and returns application-facing results.

## Responsibilities

- Execute SQL assets using defined contracts.
- Perform explicit mapping from SQL rows to DTOs.
- Enforce CUD semantics at the application boundary (including "0 rows" handling).

## Contract ownership (important)

- Input parameter types and DTO shapes are defined in specs ("src/catalog/specs").
- Repositories MUST NOT invent or modify contracts.
- Repositories may adapt SQL results into DTOs, but must not redefine the contract.

## SQL usage rules (tables CRUD quality bar)

- Repositories in this folder MUST treat SQL assets as human-maintained, idiomatic SQL.
- Do not require SQL assets to implement driver-specific behaviors.
- If a driver does not provide affected-row counts for UPDATE/DELETE, fail fast as unsupported.

Examples:
- Prefer a plain UPDATE statement in SQL.
- Do not force SQL to return `affected_count` via CTE tricks.

## CUD behavior rules

### CREATE (INSERT)

Default:
- SQL MUST use `insert ... returning <primary_key>` when a generated key is needed.
- Repository CREATE MUST return identifier only (scalar) per contract.
- Repository CREATE MUST NOT perform a follow-up SELECT for DTO return shaping.
- SQL MUST NOT return full rows or DTO-shaped payloads.

Exception:
- If a CREATE endpoint must return DTO, the spec MUST explicitly require it by human instruction.
- Without that explicit contract, identifier-only return is mandatory.

### UPDATE

Default:
- SQL: plain UPDATE without RETURNING.
- Repository: determine success by affected row count when available.

Driver variability handling:
- If affected row count is unavailable:
  - Treat UPDATE verification as unsupported for that driver/runtime.
  - Throw an explicit error.
- Do not add fallback checks or workaround logic in repositories.
- Do not push this variability down into SQL assets.

0-row rule (important):
- Treat "0 rows updated" as a meaningful condition.
- Default behavior is to surface it clearly (often an error), per spec.

### DELETE

Default:
- SQL: plain DELETE without RETURNING.
- Repository: determine success by affected row count when available.

Driver variability handling:
- If affected row count is unavailable:
  - Treat DELETE verification as unsupported for that driver/runtime.
  - Throw an explicit error.
- Do not add fallback checks or workaround logic in repositories.

0-row rule (important):
- Treat "0 rows deleted" as a meaningful condition, per spec.

## Patch updates (important)

- Avoid ambiguous patterns such as `coalesce(param, column)` by default.
- Contracts should distinguish:
  - "not provided"
  - "explicitly set to null"
- If patch semantics are needed, implement them explicitly via:
  - separate SQL variants, or
  - explicit contract types that preserve intent.

## Testing rule (required)

- Every public repository method MUST be covered by tests.
- Tests should verify:
  - correct mapping behavior
  - correct "0 rows" behavior for UPDATE/DELETE
  - correct error surfaces (do not silently succeed)
