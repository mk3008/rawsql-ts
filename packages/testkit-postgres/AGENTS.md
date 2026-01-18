# @rawsql-ts/testkit-postgres

This package hosts the Postgres-specific **rewriter and fixture helpers** that remain driver-agnostic.
They are the pieces of pg-testkit that need Postgres semantics (DDL fixtures, normalized table names, CRUD-to-SELECT rewrites),
but they do **not** depend on `pg` itself.

## Responsibilities

- Accept a `QueryExecutor` that can run rewritten SQL, return `Row[]`, and let the core wrap it into the standard `CountableResult`.
- Validate fixture tables against DDL-derived or explicit table definitions.
- Provide helpers such as `createPostgresTestkitClient` and `resolveFixtureState`.
- Surface diagnostics when DDL directories are missing/empty or fixtures refer to unknown schema elements.

## Non-responsibilities

- Do not import or manage any `pg` types or clients; driver wiring belongs in the adapter packages.
- Do not execute SQL directly; the executor you provide is responsible for that.
- Do not duplicate the adapter pool/wrapper logic—use `@rawsql-ts/adapter-node-pg` (or another adapter) when you need a `pg` client/pool.

## Guardrails

- Public API files in `@rawsql-ts/testkit-postgres` must not import or re-export any symbols from `pg`, even as type-only declarations.
- Driver connections and any `pg`-specific types belong in adapter packages; this package only exposes the QueryExecutor boundary defined below.

## Executor contract

- `Row = Record<string, unknown>`
- `QueryExecutor = (sql: string, params: readonly unknown[]) => Promise<Row[]>`
- Adapter packages must instantiate `QueryExecutor` implementations that manage driver connections; this package only hops the rewritten SQL and params through that function and returns the resulting rows.

## Fixture validation

- Rely on `DefaultFixtureProvider` + `TableNameResolver`.
- Call `validateFixtureRowsAgainstTableDefinitions` before invoking the executor so typos fail fast.
- Expose `resolveFixtureState` so adapters can reuse the same DDL metadata snapshots.

## Adapter coordination

- Adapter packages must call `createPostgresTestkitClient` with a `QueryExecutor` that references the actual driver connection.
- Adapter tests should focus on the driver surface (client/pool/wrapping), while this package keeps unit tests driver-independent.
