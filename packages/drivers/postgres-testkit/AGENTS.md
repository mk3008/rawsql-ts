# @rawsql-ts/postgres-testkit

## Scope
- Adapts `pg` clients/pools so SELECT statements run against fixture-backed CTEs defined via `@rawsql-ts/testkit-core`.
- Mirrors the sqlite testkit surface so callers can switch between SQLite and Postgres scenarios without changing fixture or rewrite DSLs.

## Core Expectations
- Always rewrite SQL through `SelectFixtureRewriter`; do not add regex-based parsing paths in this adapter.
- Keep scaling hooks side-effect free: every `withFixtures` call should yield a new proxy or driver that reuses the same underlying connection without sharing mutable state.
- Surface clear diagnostics (`MissingFixtureError`, schema validation feedback) directly from testkit-core.

## Driver Flow
- Provide `createPostgresSelectTestDriver` and `wrapPostgresDriver` helpers that behave like the sqlite equivalents.
- Ensure `.query()` rewrites before delegating to the connection and `.close()`/`.end()` dispose the underlying handle if available.
- Log execution details only when `recordQueries` or `onExecute` are configured and keep hooks optional-safe.

## Testing & Tooling
- Use `Vitest` suites under `tests/` that cover rewrite, `withFixtures`, logging, and passthrough behavior.
- Local verification:
```
pnpm --filter @rawsql-ts/postgres-testkit lint
pnpm --filter @rawsql-ts/postgres-testkit test
pnpm --filter @rawsql-ts/postgres-testkit build
```
- No console debugging or temporary artifacts outside `./tmp/`.

## Ready Checklist
1. README covers both helper functions and any limitations compared to the SQLite driver.
2. Tests exercise connection lifecycle, logging, and fixture overrides.
3. Comments stay in English and explain non-obvious logic blocks.
