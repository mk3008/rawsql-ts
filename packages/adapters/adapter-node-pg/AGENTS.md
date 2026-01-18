# @rawsql-ts/adapter-node-pg

This package is the Node `pg` driver adapter that connects `@rawsql-ts/testkit-postgres` to PostgreSQL clients and pools.

## Responsibilities

- Provide the legacy helpers `createPgTestkitClient`, `createPgTestkitPool`, and `wrapPgClient` so existing tooling keeps working.
- Intercept CRUD queries, hand them to `@rawsql-ts/testkit-postgres`, and execute the rewritten SQL on the underlying `pg` connection.
- Honor configurable fixture metadata (`ddl`, `tableDefinitions`, `tableRows`, `missingFixtureStrategy`) and forward diagnostics/offExecute hooks to the core.
- Share the same `withFixtures` semantics by reusing the driver-agnostic client.

## Non-responsibilities

- Do not contain any rewriting logic; every rewrite occurs inside `@rawsql-ts/testkit-postgres`.
- Do not bypass DDL/fixture validation because the core package already enforces schema safety.
- Avoid duplicating the executor interface; expose only the `pg`-familiar surface and rely on the shared core for actual transformations.

## Testing

- Integration tests run against Testcontainers’ PostgreSQL instance to confirm the adapter can wrap real clients/pools without mutating tables.
