# @rawsql-ts/pg-testkit

## Purpose of pg-testkit

`pg-testkit` is the **Postgres-specific ZTD driver**.\
It connects to a real PostgreSQL engine but **never reads or writes physical tables**.\
All CRUD statements are rewritten into **fixture‑backed SELECT queries**, while the actual `pg` engine provides: - query planning\
- parameter handling\
- type casting\
- execution of the rewritten SELECT

The driver must never bypass rewrite logic or attempt any real
migration.

## Responsibilities

-   Adapt `testkit-core` rewrite results to PostgreSQL.
-   Execute rewritten SELECT queries against a live pg client/pool.
-   Load DDL-based fixtures using `DDLToFixtureConverter`.
-   Provide helpers:
    -   `createPgTestkitClient`\
    -   `createPgTestkitPool`\
    -   `wrapPgClient`\
    -   `.withFixtures()` overlay

## Non‑Responsibilities (Strict Prohibitions)

-   No physical table creation (`CREATE TABLE`, `ALTER TABLE`,
    migrations).\
-   No writing to real tables (`INSERT`, `UPDATE`, `DELETE`).\
-   No mocking of `QueryResult`.\
-   No rewrite logic inside the driver (rewrite belongs in
    testkit-core).\
-   No dialect branching beyond PostgreSQL's expected behavior.

The Postgres engine is **planner + executor only**.

## ZTD Behavior (pg-testkit version)

### 1. CRUD → SELECT

All CRUD must be rewritten (in `testkit-core`) before reaching the
driver: - INSERT → fixture rows as SELECT\
- UPDATE → updated rows via SELECT\
- DELETE → removed rows via SELECT\
- RETURNING → mapped projection\
- Unsupported paths → fail-fast error

### 2. Fixtures are authoritative

Postgres must not be consulted for schema or row data.\
`pg-testkit` only sees fixture-derived CTEs.

## DDL-Based Fixtures

`pg-testkit` supports reading real schema files:

-   Loads every `CREATE TABLE` and `INSERT` inside `.sql` files.
-   Produces fixture schema + baseline fixture rows.
-   Files are parsed once per client/pool instance.
-   Ideal for projects using schema-first workflows.

**Guidance:** - Use DDL for canonical schema information. - Use INSERT
inside DDL *only for true shared baseline data*.\
Do **not** put per-test seeds inside schema files. - Test-specific rows
should be provided via `tableRows` or `withFixtures()`.

## Fixture Precedence

1.  **DDL fixtures** (schema + shared seed rows)\
2.  **Manual fixtures** (`tableDefinitions`, `tableRows`)\
3.  **Scoped fixtures** (`client.withFixtures()`)

Later layers override earlier ones.

## API Responsibilities

### `createPgTestkitClient`

-   Lazily opens a pg connection via `connectionFactory`.
-   Every `.query` call goes through rewrite + fixture application.
-   `.withFixtures()` overlays scenario-specific rows.

### `createPgTestkitPool`

-   Same rewrite behavior as the client.
-   Transactions/savepoints pass through to raw pg delegates.

### `wrapPgClient`

-   Wraps an existing client or pool.
-   Preserves full API surface (`.query`, `.connect`, `.release`).
-   Useful for integration-style tests.

## Parameter & Type Handling

-   `$1`, `$2`, ... placeholders are normalized before rewrite and
    restored before execution.\
-   Result types follow PostgreSQL casting rules, ensuring parity with
    real-world apps.

## Sequence & Default Handling

-   Insert defaults involving `nextval(...)` become deterministic
    expressions (e.g. `row_number() over ()`).
-   Ensures consistent behavior without requiring real sequences.

## Temporary Tables

-   `CREATE TEMP TABLE … AS SELECT` survives rewriting.
-   Required because later queries may reference them.
-   All other DDL is blocked or ignored.

## Testing

-   Supports full parallel test execution (no shared state).\
-   Uses a real PostgreSQL Testcontainers instance
    (`@testcontainers/postgresql`).\
-   Each query sees an isolated fixture universe.

Run:

    pnpm --filter @rawsql-ts/pg-testkit test

## Logging & Diagnostics

-   Uses logger hooks from `testkit-core`.
-   Must never throw due to missing logger fields.
-   Emit debug traces when:
    -   fallback paths trigger\
    -   analyzer limitations appear\
    -   fixture mismatches surface

## Ready Checklist for Contributors

1.  Does not create or mutate real tables.\
2.  Does not introduce rewrite logic (belongs in testkit-core).\
3.  DDL loader behavior documented + deterministic.\
4.  `.withFixtures()` layering maintains precedence guarantees.\
5.  All added features have tests in `tests/`.\
6.  Error messages include actionable hints (table/column).
