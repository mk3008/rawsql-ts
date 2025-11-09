# @rawsql-ts/sqlite-testkit

## Scope
- Wraps `better-sqlite3` connections so SELECT statements run against fixture-backed CTEs.
- Builds directly on `@rawsql-ts/testkit-core` for schema validation, logging, and rewrites.

## Core Expectations
- Always route SQL through the testkit-core rewriter; do not implement regex-driven parsing inside the driver layer.
- When you need new rewrite behavior, extend testkit-core (AST path) first, then thread the option through this package.
- Keep adapters side-effect free: `createSqliteSelectTestDriver` and `wrapSqliteDriver` must produce disposable objects without shared global state.

## Fixture & Schema Flow
- Validate fixtures at construction time so runtime query interception stays fast.
- Respect passthrough tables and wildcard overrides exposed by testkit-core; mirror the same option names to avoid divergence.
- Provide clear errors (`MissingFixtureError`, `SchemaValidationError`) instead of generic driver exceptions.

## Driver Behavior
- Intercept `prepare`, `exec`, `all`, `get`, and `run` while delegating write operations directly to the underlying connection.
- Ensure `.withFixtures()` returns a shallow copy that inherits the base config plus overrides.
- Record query logs only when `recordQueries` is true; guard access so undefined hooks do not crash consumers.
- Close the wrapped database when `driver.close()` is called, but allow idempotent closes for test ergonomics.

## AST-First Reminder
- If you must temporarily merge SQL via regex (e.g., `WITH` injection when AST data is missing), add a TODO comment, emit a `logger.debug` notice, and file an issue referencing the blocker.
- Reject contributions that add new regex-based parsing paths when the AST already exposes the necessary metadata.

## Testing & Tooling
- Use Vitest for unit coverage and integration suites under `tests/` to exercise real `better-sqlite3` connections.
- Local loop:
```
pnpm --filter @rawsql-ts/sqlite-testkit lint
pnpm --filter @rawsql-ts/sqlite-testkit test
pnpm --filter @rawsql-ts/sqlite-testkit build
```
- For demo scenarios, use the scripts inside `demo/` to reproduce documented workflows before shipping changes.

## Environment Notes
- `better-sqlite3` requires native builds; keep `scripts/install-better-sqlite3.cjs` updated so CI installs remain stable.
- Tests must run on Node 20+; ensure optional features degrade gracefully on other platforms.

## Ready Checklist
1. Driver adapters documented in `README.md` with realistic fixture examples.
2. Tests cover connection lifecycle, fixture overrides, and AST fallback behavior.
3. No stray console logging or temp files outside `./tmp/`.
