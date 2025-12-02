# @rawsql-ts/testkit-core

## Core Role of testkit-core (ZTD Engine)

`testkit-core` is the **central engine of Zero Table Dependency(ZTD)**.\
It rewrites all CRUD SQL into **fixture‑backed SELECT queries**, without
ever creating, reading, or mutating physical tables.

### Responsibilities

-   Consume **AST produced by `rawsql-ts/core`**.
-   Apply **fixture + schema rules** to turn SQL into SELECT results.
-   Expose rewrite utilities used by **db‑specific drivers**
    (pg-testkit, sqlite-testkit).
-   Remain **DBMS-agnostic**. No Postgres/SQLite conditionals or
    behavior belong here.

### Non‑Responsibilities

-   No direct database access.
-   No physical table creation or migration.
-   No ORM/driver logic.
-   No mocking or fabricating QueryResult manually.

## ZTD Principles (testkit-core version)

1.  **Never touch real tables.**\
    The DB engine (Postgres, SQLite, etc.) is used *only* to execute the
    final rewritten SELECT.

2.  **CRUD → SELECT**

    -   INSERT → SELECT returning fixture rows\
    -   UPDATE → SELECT updated rows\
    -   DELETE → SELECT deleted rows\
    -   RETURNING → SELECT projection\
    -   Unsupported constructs (e.g., `ON CONFLICT`) → fail-fast error

3.  **Fixtures are authoritative.**\
    Schema + rows in fixtures represent the entire "database state".

4.  **Deterministic output.**\
    Rewrites must be reproducible and stable across runs.

## Package Scope

-   Provides:
    -   `SelectFixtureRewriter`
    -   `FixtureStore`
    -   Identifier normalization utilities
    -   Schema + column resolution helpers
-   Does *not* include DB-specific behavior (that belongs to drivers)
-   Expected to operate on Node 20+

## Rewrite & AST Expectations

-   Always use:
    -   `SelectQueryParser`
    -   `SelectAnalyzer`
    -   `splitQueries`
-   Regex is allowed **only** as a fallback when AST cannot express a
    construct.
    -   Must include:
        -   A comment explaining the need\
        -   A link to a tracking issue\
        -   A description of how to migrate to AST later

### Extending rewrite capability

-   Add metadata to `SelectAnalyzer` instead of re-parsing or creating
    ad-hoc regex logic.
-   Prefer token/visitor/-based improvements over post-processing string
    filters.

## Fixture & Schema Policy

### 1. Fixture authority

-   Missing fixtures → throw `MissingFixtureError`\
    (unless caller explicitly opts into `warn` or `passthrough` mode)

### 2. Identifier normalization

-   Always canonicalize identifiers via `normalizeIdentifier`.
-   Never trust caller casing or quoting.

### 3. Column resolution

-   `FixtureStore.describeColumns` must surface:
    -   table names\
    -   available columns\
    -   suggested hints

### 4. Fixture rows

-   Use `SqliteValuesBuilder` (or a similar values builder) for
    deterministic CTE VALUES creation.\
-   Never build VALUES lists manually with string interpolation.

## CUD-as-SELECT Basics (Minimal Behavior Spec)

### INSERT

-   Convert to SELECT ... FROM (VALUES fixture_rows)
-   Provide correct `RETURNING` projection

### UPDATE

-   Apply updates to fixture snapshot
-   Project updated rows via SELECT

### DELETE

-   Remove matching rows in fixture snapshot
-   Return deleted rows via SELECT

### RETURNING

-   Render RETURNING *solely* as SELECT projection

### Unsupported

-   `INSERT … ON CONFLICT`
-   Mutating CTEs like `UPDATE … RETURNING` nested inside WITH\
    → throw descriptive errors

## Multi-Statement Rewrites

-   Split using `splitQueries(sql)`
-   Rewrite each independently
-   Reassemble using `ensureTerminated` to preserve semicolons
-   Preserve original whitespace between statements
-   Do *not* reorder statements

## Error Policy (Fail-fast)

-   Missing fixture → error\
-   Unknown table/column → error\
-   Ambiguous column → error\
-   Fallback path used → must log + comment + tracking issue\
-   `warn`/`passthrough` modes must behave *predictably* and never
    silently rewrite incorrect SQL

## Logging & Diagnostics

-   Use `createLogger` hook for:
    -   debug traces\
    -   fallback path activation\
    -   analyzer failures\
-   Guard logger usage (`logger.debug?.()`) to avoid crashes when
    consumer passes a partial logger.

## Testing

### Required coverage

-   fixture resolution paths
-   CRUD rewrite transformations
-   CTE + multi-statement handling
-   fallback logic
-   identifier casing rules
-   error diagnostics

### Run locally

    pnpm --filter @rawsql-ts/testkit-core lint
    pnpm --filter @rawsql-ts/testkit-core test
    pnpm --filter @rawsql-ts/testkit-core build

### Writing tests

-   Prefer small, focused SQL samples.
-   Integration-level coverage already exists in
    `tests/SelectFixtureRewriter.test.ts`.

## Prohibited (Anti-Patterns)

-   DBMS branching (`if postgres`, `if sqlite`, etc.)
-   Rewriting SQL by string concatenation without AST
-   Re-parsing SQL after rewrite
-   Mutating fixtures as global state (must stay scoped)
-   Using QueryResult-like objects hand-written by the testkit
-   Letting fallback regex silently alter semantics

## Ready Checklist

1.  ZTD constraints satisfied (no physical table assumptions)
2.  Features documented in README (usage + limitations)
3.  Tests added for both AST success path & fallback
4.  Diagnostics include helpful table/column hints
5.  No unmarked regex parsing exists
