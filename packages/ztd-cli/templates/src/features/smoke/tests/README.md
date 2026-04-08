# Smoke Tests

This folder contains the feature-local tests for the removable `smoke` sample.

- `smoke.entryspec.test.ts`, `smoke.test.ts`, and `smoke.validation.test.ts` stay DB-free and show the smallest unit-test path.
- `src/features/smoke/queries/smoke/tests/smoke.queryspec.ztd.test.ts` uses the fixed app-level ZTD harness from `tests/support/ztd/harness.ts`, requires `ZTD_DB_URL`, and proves the starter DB-backed path.
- The fixed app-level ZTD runner lives in `tests/support/ztd/harness.ts`; query-local cases should live in `tests/cases/` and call into that runner.
- Real feature scaffolds also add a thin `<query>.queryspec.ztd.test.ts` Vitest entrypoint next to the query-local tests, plus a feature-root `<feature>.entryspec.test.ts` for the mock-based lane.
- The starter setup loads `.env` through `tests/support/setup-env.ts` and derives `ZTD_DB_URL` from `ZTD_DB_PORT`.
- The starter defaults for `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` live in `ztd.config.json`; the helper reads them so follow-up DB-backed tests can reuse the same setup.
- Expect the DB-backed path to fail until the starter database is configured.

