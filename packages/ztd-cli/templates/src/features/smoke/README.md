# Smoke Feature

`smoke` is the starter-only sample feature in the scaffold.
It lives at `src/features/smoke` and is safe to delete once the first real feature exists.

This feature intentionally contains two narrow paths:

- a DB-free sample function with feature-local unit tests
- a DB-backed smoke test that uses `createStarterPostgresTestkitClient` from `tests/support/postgres-testkit.ts` on top of `@rawsql-ts/testkit-postgres` and checks `ZTD_TEST_DATABASE_URL` connectivity
- a minimal named-parameter SQL example that uses `:v1` and `:v2`

Use it as a pattern for the next real feature, then remove the whole folder when the starter sample is no longer useful. If you add another DB-backed feature, reuse the same thin starter helper and keep the new fixtures near the new test.
