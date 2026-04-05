# Smoke Feature

`smoke` is the starter-only sample feature in the scaffold.
It lives at `src/features/smoke` and mirrors the fixed `users-insert` layout with one feature boundary and one query boundary.

## Fixed feature layout contract

```text
src/features/<feature-name>/
  spec.ts
  tests/
    <feature-name>.entryspec.test.ts
  queries/
    <query-name>/
      spec.ts
      <query-name>.sql
      tests/
        <query-name>.queryspec.ztd.test.ts
      generated/
        TEST_PLAN.md
        analysis.json
      cases/
  README.md
```

## CLI-created files

- `spec.ts`
- `tests/smoke.entryspec.test.ts`
- `queries/smoke/spec.ts`
- `queries/smoke/smoke.sql`
- `queries/smoke/tests/smoke.queryspec.ztd.test.ts`
- `README.md`

## Shared helper files created by the CLI when missing

- `src/features/_shared/featureQueryExecutor.ts`
- `src/features/_shared/loadSqlResource.ts`

## CLI-owned generated files

- `queries/smoke/tests/queryspec-ztd-types.ts`
- `queries/smoke/tests/generated/TEST_PLAN.md`
- `queries/smoke/tests/generated/analysis.json`
- `generated/*` is CLI-owned and refreshable.

## Human/AI-owned persistent files

- persistent case files under `queries/smoke/tests/cases/`
- `queries/smoke/tests/smoke.queryspec.ztd.test.ts` is a thin Vitest entrypoint and is kept.

## Boundary responsibilities

- `spec.ts` is the feature outer-boundary specification for request parsing, normalization, rejection, query-parameter assembly, and response shaping.
- `spec.ts` uses `zod` schemas for request and response DTOs, and the scaffold includes `trim()` plus empty-string rejection examples for current string inputs.
- `spec.ts` keeps its schema values and helper functions file-local; it converts request data to query params explicitly and depends on the shared executor contract directly.
- `queries/smoke/spec.ts` is the DB-boundary specification for query params, row shape, query result shape, row-to-result mapping, and SQL execution contract.
- `queries/smoke/spec.ts` keeps its `zod` schema values, row type, and helper functions private, completes params / row / result parsing internally, and depends on the shared executor contract directly.
- `queries/smoke/spec.ts` and `queries/smoke/smoke.sql` stay co-located as one spec/SQL pair.
- `tests/smoke.entryspec.test.ts` is the thin Vitest entrypoint for the feature boundary lane.
- `queries/smoke/tests/smoke.queryspec.ztd.test.ts` is the thin Vitest entrypoint for the ZTD query lane.
- The starter query reads the removable `public.users` sample row so the smoke path still proves both connectivity and schema wiring.

## Follow-up query growth

- Keep this baseline as one workflow and one primary query by default; add another sibling query directory under `queries/` only if a follow-up intentionally expands the feature.
- If a follow-up adds another query directory, keep each query directory self-contained with exactly one `spec.ts` and one SQL resource.
- Add transport-specific adapters later only when a concrete transport contract exists.

## Shared helper note

- `src/features/_shared/featureQueryExecutor.ts` is the shared runtime contract for DB execution injection.
- `src/features/_shared/loadSqlResource.ts` loads co-located SQL resources for the feature queries.
- Cardinality and catalog execution should come from `@rawsql-ts/sql-contract` so the scaffold does not re-invent feature-local helpers.

## Follow-up customization points

- Narrow field types and validation rules once the transport contract is known.
- Replace any scaffolded SQL filter if the feature needs a different explicit query shape.
- After the SQL and DTO edits settle, run `ztd feature tests scaffold --feature smoke` to refresh the CLI-owned generated files, keep the thin Vitest entrypoint in place, and then keep the persistent case files as human/AI-owned query-local assets.
