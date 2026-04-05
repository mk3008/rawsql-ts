# Feature-First Layout

This scaffold organizes application work under `src/features/<feature>/`.

## Default shape

- `domain`: pure business rules and invariants
- `application`: orchestration and use-case flow
- `persistence`: one SQL file, one spec, and the mapping helpers for that unit
- `tests`: feature-local checks that keep the slice honest, including a thin `tests/<feature>.entryspec.test.ts` Vitest entrypoint for the mock-based lane and per-query `tests/<query>.queryspec.ztd.test.ts` Vitest entrypoints for the ZTD lane

`ztd.config.json` owns the tool-managed workspace under `.ztd/tests/` and `.ztd/generated/`. Feature-authored tests stay under `src/features/<feature>/tests/`, while generated runtime artifacts stay in `.ztd/`.

Use `ztd feature tests scaffold --feature <feature-name>` after SQL and DTO edits to refresh `src/features/<feature>/<query>/tests/generated/TEST_PLAN.md` and `analysis.json`, keep the thin `src/features/<feature>/<query>/tests/<query>.queryspec.ztd.test.ts` entrypoint in sync, and add persistent cases under `src/features/<feature>/<query>/tests/cases/` with the fixed app-level ZTD runner.
When you are on the queryspec lane, treat it as query-local: `src/features/<feature>/<query>/tests/<query>.queryspec.ztd.test.ts`, `src/features/<feature>/<query>/tests/generated/`, and `src/features/<feature>/<query>/tests/cases/` move together, while the feature-root `src/features/<feature>/tests/<feature>.entryspec.test.ts` stays on the mock-based lane.

## Sample feature

If you enabled the starter flow, `smoke` is the removable teaching feature.
Copy its shape for the first real feature, then delete it once the project has a real slice of its own.
In the starter flow, `smoke` also shows the DB-backed path through `@rawsql-ts/testkit-postgres` and the preferred named-parameter SQL style through its feature-local SQL sample.

