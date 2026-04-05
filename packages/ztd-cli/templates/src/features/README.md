# Feature-First Layout

This scaffold organizes application work under `src/features/<feature>/`.

## Default shape

- `domain`: pure business rules and invariants
- `application`: orchestration and use-case flow
- `spec.ts`: the single feature boundary definition file for request parsing, normalization, and response shaping
- `queries/<query>/spec.ts`: the single query boundary definition file for DB-facing SQL execution and row/result mapping
- `tests`: feature-local checks that keep the slice honest, including a thin `tests/<feature>.entryspec.test.ts` Vitest entrypoint for the mock-based lane and per-query `queries/<query>/tests/<query>.queryspec.ztd.test.ts` Vitest entrypoints for the ZTD lane

`ztd.config.json` owns the tool-managed workspace under `.ztd/generated/` and `.ztd/tests/` support files. Feature-authored boundary tests stay under `src/features/<feature>/tests/`, while query-local ZTD assets stay under `src/features/<feature>/queries/<query>/tests/{generated,cases}`.

Use `ztd feature tests scaffold --feature <feature-name>` after SQL and DTO edits to refresh `src/features/<feature>/queries/<query>/tests/generated/TEST_PLAN.md` and `analysis.json`, keep the thin `src/features/<feature>/queries/<query>/tests/<query>.queryspec.ztd.test.ts` entrypoint in sync, and add persistent cases under `src/features/<feature>/queries/<query>/tests/cases/` with the fixed app-level ZTD runner.
When you are on the spec lane, treat it as query-local: `src/features/<feature>/queries/<query>/tests/<query>.queryspec.ztd.test.ts`, `src/features/<feature>/queries/<query>/tests/generated/`, and `src/features/<feature>/queries/<query>/tests/cases/` move together, while the feature-root `src/features/<feature>/tests/<feature>.entryspec.test.ts` stays on the mock-based lane.

## Sample feature

If you enabled the starter flow, `smoke` is the removable teaching feature.
Copy its shape for the first real feature, then delete it once the project has a real slice of its own.
In the starter flow, `smoke` also shows the DB-backed path through `@rawsql-ts/testkit-postgres` and the preferred named-parameter SQL style through its feature-local SQL sample.

