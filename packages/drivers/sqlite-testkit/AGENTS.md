# @rawsql-ts/sqlite-testkit – AGENTS

## Purpose of sqlite-testkit

`sqlite-testkit` is the **SQLite-specific ZTD driver**.  
It wraps `better-sqlite3` connections so that all queries run against **fixture-backed SELECT rewrites**, never against real tables as persisted state.

The underlying SQLite engine is treated purely as:

- a query planner
- a type system
- an executor for rewritten SELECT statements

It must **not** be used as a migration target or a persistent data store in tests.

## Responsibilities

- Adapt `@rawsql-ts/testkit-core` rewrite results to `better-sqlite3`.
- Execute rewritten SELECT statements on a live SQLite connection.
- Provide helpers such as:
  - `createSqliteSelectTestDriver`
  - `wrapSqliteDriver`
  - `.withFixtures()` overlays for scenario-specific data.
- Mirror testkit-core options for fixtures, passthrough behavior, and logging.

## Non-Responsibilities (Strict Prohibitions)

- No physical table management (`CREATE TABLE`, `ALTER TABLE`, migrations) through the wrapped driver.
- No real writes to persistent tables as part of tests (`INSERT`, `UPDATE`, `DELETE` must be handled via rewrites in testkit-core).
- No regex-based SQL parsing inside sqlite-testkit.
- No mocking or hand-crafting of `better-sqlite3` result shapes to bypass the rewrite pipeline.
- No cross-test global state or singleton fixtures.

SQLite’s file or in-memory database is an **execution engine only**, not an authoritative data store.

## Core Expectations

- All SQL must flow through the **testkit-core AST rewriter** before execution.
  - If you need new rewrite behavior, extend testkit-core first, then thread the option into sqlite-testkit.
- Adapters must be **side-effect free**:
  - `createSqliteSelectTestDriver` and `wrapSqliteDriver` produce disposable objects.
  - No hidden global caches or shared mutable state across drivers.

## Fixture & Schema Flow

- Validate fixtures at construction time to keep per-query interception fast.
- Fixture and schema rules are driven by testkit-core:
  - Respect passthrough tables and wildcard overrides.
  - Normalize identifiers as required by testkit-core helpers.
- Surface clear, typed errors from this layer:
  - `MissingFixtureError`
  - `SchemaValidationError`
  - descriptive messages with table/column hints.

Tests must be able to understand from errors **which fixture or table definition is missing or mismatched**.

## Driver Behavior

- Intercept `prepare`, `all`, `get`, and `run` (and other read APIs) to:
  - apply AST-based rewrite from testkit-core,
  - execute the resulting SELECT against `better-sqlite3`.
- Writes from the application perspective (`INSERT`, `UPDATE`, `DELETE`) must have already been rewritten into SELECTs by testkit-core before they reach sqlite-testkit.
- `.withFixtures()` must:
  - return a shallow copy of the driver,
  - inherit base configuration,
  - layer additional fixtures/scenario-specific data on top.
- `recordQueries`:
  - Only record queries when `recordQueries` is true.
  - Guard all logging hooks so missing callbacks never crash consumers.
- Connection lifecycle:
  - `driver.close()` closes the wrapped database handle.
  - Multiple `close()` calls must be idempotent for test ergonomics.

## AST-First Reminder

- sqlite-testkit must never own parsing responsibilities.
- If a **temporary regex-based merge** (e.g., `WITH` injection) is absolutely required:
  - add a `TODO` and an inline comment explaining the limitation,
  - emit a `logger.debug` notice through the provided logger,
  - file an issue describing the AST feature needed in testkit-core.
- Reject contributions that add new regex parsing paths when AST metadata already exists.

## Testing & Tooling

- Use **Vitest** for both unit and integration-level coverage.
- Integration tests should exercise real `better-sqlite3` connections.

Local workflow:

```bash
pnpm --filter @rawsql-ts/sqlite-testkit lint
pnpm --filter @rawsql-ts/sqlite-testkit test
pnpm --filter @rawsql-ts/sqlite-testkit build
```

- For demos, use scripts under `demo/` to reproduce README scenarios and ensure docs stay in sync with behavior.

## Environment Notes

- `better-sqlite3` requires native compilation.
  - Keep `scripts/install-better-sqlite3.cjs` up to date so CI and local installs stay reliable.
- Supported runtime: Node 20+.
  - Optional features must degrade gracefully on other platforms or Node versions (e.g., skip features that are not available).

## ZTD Constraints (SQLite Edition)

- Even for in-memory databases, **do not rely on real table state** between queries.
- All perceived state must originate from fixtures supplied to the driver.
- Tests must remain deterministic regardless of file-backed vs. memory-backed SQLite configurations.

## Ready Checklist

1. Adapters documented in `README.md` with realistic fixture-based examples.
2. No regex-based parsing except clearly-marked temporary fallbacks with issues filed.
3. Tests cover:
   - connection lifecycle,
   - fixture overrides and `withFixtures`,
   - AST fallback behavior,
   - error messages for missing/invalid fixtures.
4. No stray `console.log` or temp files outside `./tmp/`.
5. No code path bypasses testkit-core’s rewrite pipeline.
