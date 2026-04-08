# Feature-First Layout

This scaffold organizes application work under `src/features/<feature>/`.

## Architecture as a Framework

The feature layout treats architecture as a framework contract, not a naming convention:

```text
boundary/
  boundary.ts
  child-boundary/
  tests/
```

- A folder is a boundary.
- `boundary.ts` is that boundary's public surface.
- Child boundaries are child folders that repeat the same rule.
- `tests/` is the verification group owned by that boundary.
- Cross-boundary tests should go through `boundary.ts`, not internal helper files.

## Default shape

- `boundary.ts`: the single feature boundary public surface for request parsing, normalization, and response shaping
- `queries/<query>/boundary.ts`: the single query boundary public surface for DB-facing SQL execution and row/result mapping
- `tests`: the feature-local verification group, including a thin `tests/<feature>.boundary.test.ts` Vitest entrypoint for the mock-based lane
- `queries/<query>/tests`: the query-local verification group, including a thin `queries/<query>/tests/<query>.boundary.ztd.test.ts` Vitest entrypoint for the ZTD lane
- add more child boundaries as child folders when one boundary grows; each child repeats the same `boundary.ts` plus `tests/` rule

`ztd.config.json` owns the tool-managed workspace under `.ztd/generated/` and `.ztd/tests/` support files. Feature-authored boundary tests stay under `src/features/<feature>/tests/`, while query-local ZTD assets stay under `src/features/<feature>/queries/<query>/tests/{generated,cases}`.

Use `ztd feature tests scaffold --feature <feature-name>` after SQL and DTO edits to refresh `src/features/<feature>/queries/<query>/tests/generated/TEST_PLAN.md` and `analysis.json`, keep the thin `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts` entrypoint in sync, and add persistent cases under `src/features/<feature>/queries/<query>/tests/cases/` with the fixed app-level ZTD runner.
When you are on the boundary lane, treat it as query-local: `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts`, `src/features/<feature>/queries/<query>/tests/generated/`, and `src/features/<feature>/queries/<query>/tests/cases/` move together, while the feature-root `src/features/<feature>/tests/<feature>.boundary.test.ts` stays on the mock-based lane.

## Import Paths

Prefer root-based imports once the project grows beyond shallow nesting.

- Recommended direction: add a project-root import convention such as `#src/*` package imports or an equivalent root alias that works in both TypeScript and runtime resolution.
- Minimum rule: do not let deep relative imports become the public boundary contract.
- When a boundary depends on another boundary, make the dependency obvious by importing its compiled ESM entrypoint with `.js` specifiers, such as `./boundary.js` or `../boundary.js`, rather than walking through internal files.

## Sample feature

If you enabled the starter flow, `smoke` is the removable teaching feature.
Copy its shape for the first real feature, then delete it once the project has a real slice of its own.
In the starter flow, `smoke` also shows the DB-backed path through `@rawsql-ts/testkit-postgres` and the preferred named-parameter SQL style through its feature-local SQL sample.

