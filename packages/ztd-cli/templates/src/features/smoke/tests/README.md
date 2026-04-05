# Smoke Tests

This folder contains the feature-local tests for the removable `smoke` sample.

- `smoke.test.ts` and `smoke.validation.test.ts` stay DB-free and show the smallest unit-test path.
- `smoke.queryspec.test.ts` uses `createStarterPostgresTestkitClient` from `.ztd/support/postgres-testkit.ts`, requires `ZTD_TEST_DATABASE_URL`, and proves the starter DB-backed path.
- The fixed app-level ZTD runner lives in `tests/ztd/harness.ts`; query-local cases should live in `tests/cases/` and call into that runner.
- Real feature scaffolds also add a thin `<query>.queryspec.ztd.test.ts` Vitest entrypoint next to the query-local tests, plus a feature-root `<feature>.entryspec.test.ts` for the mock-based lane.
- The starter setup loads `.env` through `.ztd/support/setup-env.ts` and derives `ZTD_TEST_DATABASE_URL` from `ZTD_DB_PORT`.
- The starter defaults for `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` live in `ztd.config.json`; the helper reads them so follow-up DB-backed tests can reuse the same setup.
- Expect the DB-backed path to fail until the starter database is configured.

