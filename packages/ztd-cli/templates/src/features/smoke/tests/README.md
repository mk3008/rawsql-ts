# Smoke Tests

This folder contains the feature-local tests for the removable `smoke` sample.

- `smoke.test.ts` and `smoke.validation.test.ts` stay DB-free and show the smallest unit-test path.
- `smoke.queryspec.test.ts` uses the feature-local QuerySpec, requires `ZTD_TEST_DATABASE_URL`, and executes the named-parameter SQL sample.
- Expect the DB-backed path to fail until the starter database is configured.

