# Feature-First Layout

This scaffold organizes application work under `src/features/<feature>/`.

## RFBA layout

This feature layout follows RFBA (Review-First Backend Architecture).
RFBA splits backend files by review responsibility so SQL, orchestration, public surfaces, dependency direction, and verification scope stay easy to inspect.
Within the ztd-cli app model, the structural layers are:

```text
root-boundary/
  feature-boundary/
    sub-boundary/
```

- `root-boundary` is the app-level boundary layer. In rawsql-ts, the concrete root boundaries are `src/features`, `src/adapters`, and `src/libraries`.
- `feature-boundary` is a feature-owned boundary under `src/features/<feature>/`.
- `sub-boundary` is an optional child boundary inside one feature when review responsibility, allowed dependencies, public surface, or verification scope changes.

## Default shape

- `boundary.ts`: the default `feature-boundary` public surface for request parsing, normalization, and response shaping
- `queries/`: the child-boundary container; it is not itself a public boundary
- `queries/<query>/boundary.ts`: the default child query public surface for DB-facing SQL execution and row/result mapping
- `tests`: the feature-local verification group, including a thin `tests/<feature>.boundary.test.ts` Vitest entrypoint for the mock-based lane
- `queries/<query>/tests`: the query-local verification group, including a thin `queries/<query>/tests/<query>.boundary.ztd.test.ts` Vitest entrypoint for the ZTD lane
- add more child folders only when a real `sub-boundary` is needed; keep its public surface and verification local to that child folder

Inside `src/features/*`, `boundary.ts` is the default scaffold entrypoint for `feature-boundary` and `sub-boundary` code.
It is a feature-scoped convention for discoverability and scaffold compatibility, not the full definition of RFBA and not a universal filename requirement.
The query folder is the query unit: SQL, row/result mapping, execution contract, and query-local tests move together for review.

`ztd.config.json` owns the tool-managed workspace under `.ztd/generated/` and `.ztd/tests/` support files. Feature-authored boundary tests stay under `src/features/<feature>/tests/`, while query-local ZTD assets stay under `src/features/<feature>/queries/<query>/tests/{generated,cases}`.
Use `src/features/_shared/*` only for feature-facing shared seams such as `FeatureQueryExecutor`; it is not a fourth root-boundary.
Keep driver-neutral helpers in `src/libraries/*`, keep driver or sink bindings in `src/adapters/<tech>/*`, treat `tests/support/*` as shared verification support, and keep `db/` reserved for DDL, migrations, and schema assets rather than runtime clients or adapters.
Do not count `src/features/_shared/*`, `tests/support/*`, `.ztd/*`, or `db/` as root boundaries.

Use `ztd feature tests scaffold --feature <feature-name>` after SQL and DTO edits to refresh `src/features/<feature>/queries/<query>/tests/generated/TEST_PLAN.md` and `analysis.json`, keep the thin `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts` entrypoint in sync, and add persistent cases under `src/features/<feature>/queries/<query>/tests/cases/` with the fixed app-level ZTD runner.
When you are on the boundary lane, treat it as query-local: `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts`, `src/features/<feature>/queries/<query>/tests/generated/`, and `src/features/<feature>/queries/<query>/tests/cases/` move together, while the feature-root `src/features/<feature>/tests/<feature>.boundary.test.ts` stays on the mock-based lane.

## Import Paths

Prefer stability at recursive boundary seams over one blanket import style.

- Keep local, nearby references relative when they naturally move with the same boundary.
- Stabilize only shared references that are likely to break when a boundary is split and moved deeper, such as `src/features/_shared/*` or `tests/support/*`.
- One workable tactic is package `imports` such as `#features/*` and `#tests/*`, or an equivalent alias that works in both TypeScript and runtime resolution.
- Minimum rule: do not let deep relative imports become the public boundary contract.
- When a feature-boundary or sub-boundary depends on another boundary, make the dependency obvious by importing its compiled ESM entrypoint with `.js` specifiers, such as `./boundary.js` or `../boundary.js`, rather than walking through internal files.
- Pragmatic exception: designated shared seams such as `src/features/_shared/*` and `tests/support/*` may use stabilized root-level aliases because those files are shared support seams, not another boundary's private implementation.

## Sample feature

If you enabled the starter flow, `smoke` is the removable teaching feature.
Copy its shape for the first real feature, then delete it once the project has a real slice of its own.
In the starter flow, `smoke` also shows the DB-backed path through `@rawsql-ts/testkit-postgres` and the preferred named-parameter SQL style through its feature-local SQL sample.

