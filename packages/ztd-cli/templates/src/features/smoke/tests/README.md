# Smoke Tests

This folder contains the feature-local tests for the removable `smoke` sample.

- `smoke.test.ts` and `smoke.validation.test.ts` stay DB-free and show the smallest unit-test path.
- `smoke.queryspec.test.ts` uses `createStarterPostgresTestkitClient` from `tests/support/postgres-testkit.ts`, requires `ZTD_TEST_DATABASE_URL`, and proves the starter DB-backed path.
- The starter setup loads `.env` through `tests/support/setup-env.ts` and derives `ZTD_TEST_DATABASE_URL` from `ZTD_DB_PORT`.
- The starter defaults for `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` live in `ztd.config.json`; the helper reads them so follow-up DB-backed tests can reuse the same setup.
- Expect the DB-backed path to fail until the starter database is configured.

