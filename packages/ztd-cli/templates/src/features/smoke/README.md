# Smoke Feature

`smoke` is the starter-only sample feature in the scaffold.
It lives at `src/features/smoke` and is safe to delete once the first real feature exists.

This feature intentionally contains two narrow paths:

- a DB-free sample function with feature-local unit tests
- a DB-backed QuerySpec test that also checks `ZTD_TEST_DATABASE_URL` connectivity
- a minimal named-parameter SQL example that uses `:v1` and `:v2`

Use it as a pattern for the next real feature, then remove the whole folder when the starter sample is no longer useful.
