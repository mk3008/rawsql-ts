# Smoke Tests

This folder contains the feature-local tests for the removable `smoke` sample.

- `smoke.test.ts` and `smoke.validation.test.ts` stay DB-free and show the smallest unit-test path.
- `smoke.queryspec.test.ts` uses the feature-local QuerySpec, requires `ZTD_TEST_DATABASE_URL`, and executes the named-parameter SQL sample.
- The starter setup loads `.env` through `tests/support/setup-env.ts` and derives `ZTD_TEST_DATABASE_URL` from `ZTD_DB_PORT`.
- Expect the DB-backed path to fail until the starter database is configured.

