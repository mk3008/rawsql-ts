# Zero Table Dependency Project

This project uses Zero Table Dependency (ZTD) to keep SQL, DDL, and tests aligned.

Key folders:
- ztd/ddl: schema files (source of truth)
- src: application SQL and repositories
- tests: ZTD tests and support

## Human-owned interfaces

- `ztd/ddl/**`: physical schema contract (DDL source of truth).
- `src/catalog/specs/**`: query contracts (params, DTO shape, behavior).
- `src/sql/**`: executable SQL assets.
- `src/repositories/**`: repository method signatures and call contracts.
- `src/dto/**` (if present): DTO structures shared with app layers.

## AI-owned glue

- `src/catalog/runtime/**`: runtime normalization, mapping, validation, tracing hooks.
- repository implementation details under `src/repositories/**` that reconcile human-owned contracts.
- tests under `tests/**` (except `tests/generated/**`) that verify contracts and runtime behavior.

## Non-negotiables

- SQL must stay SQL-client runnable; do not introduce custom SQL syntax.
- SQL string concatenation/composition for query building is forbidden.
- Positional SQL params (`$1`, `$2`, ...) are forbidden in SQL assets.
- CamelCase SQL aliases (for example `as "userId"`) are forbidden.

## Tracing (query_id-centric)

- Every catalog query execution must emit a trace event with `query_id`.
- Minimum event fields: `query_id`, `phase`, `duration_ms`, `row_count`, `param_shape`, `error_summary`, `source`.
- Trace events must be vendor-agnostic (plain callback/log), so local/dev/eval can consume the same signal.
- Use traces to debug query regressions, identify slow paths, and map failures back to catalog specs.

## Eval Prompt Contract

The eval harness runs fixed prompt contracts for:
- `crud-basic`
- `crud-complex`
- `dynamic-search`

Contract expectations:
- The first step can require a deterministic marker write in `tests/`.
- AI must keep edits inside allowed scopes and then continue CRUD tasks.
- Reports score both execution outcomes and architecture/rule compliance.

## Eval Scorecards

Score axes:
- install/typecheck/test
- rules (`sql_composition`, named params, alias style)
- architecture (`catalog_trace_quality`, `repository_catalog_boundary`)

Interpretation:
- Hard-fail categories (`sql_composition`, `sql_rules`) require immediate fixes.
- Repeated failures should be converted into stricter AGENTS guidance or template defaults.

Next steps:
1. Update `ztd/ddl/<schema>.sql` if needed.
2. Run `npx ztd ztd-config`.
3. Provide a SqlClient implementation.
4. Run tests (`pnpm test` or `npx vitest run`).
