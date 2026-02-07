# src/catalog/runtime AGENTS

This directory contains runtime wiring for catalog specs:
- parameter validation entrypoints
- row-to-DTO mapping
- output validation

## Runtime classification

- This is a runtime directory.
- Code here is executed/loaded by the application.

## Responsibilities (critical)

- Runtime MUST be the only place that:
  - validates unknown inputs into typed params
  - maps SQL rows (snake_case) into DTO objects
  - validates DTO outputs before returning to repositories
- Runtime output validation MUST follow the output contract type (DTO or scalar).
- Command outputs MAY be scalar identifiers or `void`; DTO mapping is required only when the output contract is DTO.

Repositories MUST call runtime helpers (ensure*/map*) and MUST NOT bypass them.

## Validator requirement (required)

- A validator library (zod or arktype) is always available.
- Runtime MUST apply validators for:
  - input params (unknown -> typed)
  - outputs (mapped DTO -> validated DTO)

Do not rely on TypeScript types alone.

## SQL row normalization (important)

SQL drivers may return different runtime representations for the same column types.
Runtime MUST normalize driver-dependent values before validating DTOs.

Required normalization rules:
- Timestamp columns (e.g. timestamptz) may arrive as Date or string.
  - Runtime MUST normalize with the local runtime helper (`normalizeTimestamp`).
  - Do NOT bypass the helper in repositories.
  - Do NOT silently accept invalid timestamp payloads.
- Numeric columns may arrive as number, string, or bigint depending on driver.
  - Normalization rules MUST be explicit per contract and MUST NOT be silent.

Never force SQL assets to encode driver-specific behavior.

## Mapping rules (required)

- Keep SQL assets snake_case and DTO-independent.
- Mapping occurs in runtime:
  - snake_case row -> DTO-shaped object
  - apply normalization
  - validate via spec-owned validator
- DTO camelCase aliases in SQL are forbidden.

## Entry points (recommended)

Prefer these patterns:
- `ensureXxxParams(value: unknown): XxxParams` (validate inputs)
- `mapXxxRowToDto(row: XxxSqlRow): XxxDto` (normalize + validate outputs)

The `map*` functions MUST always validate before returning.

## Error behavior (required)

- Validation errors must fail fast with clear messages.
- Do not swallow validator errors.
- Do not silently coerce invalid values unless explicitly defined by the contract.

## Tracing (required)

- Every catalog query execution MUST emit a trace event.
- Trace payload MUST include:
  - `query_id`
  - `phase`
  - `duration_ms`
  - `row_count`
  - `param_shape` (shape only; no raw values)
  - `error_summary`
  - `source`
- Tracing MUST be vendor-agnostic and callback-pluggable.

## Boundaries

- Do not perform database I/O here.
- Do not import from "tests/" or "tests/generated/".
- Do not define human-owned contracts here; they live in "src/catalog/specs".
