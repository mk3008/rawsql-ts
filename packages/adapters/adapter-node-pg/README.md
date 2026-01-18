# @rawsql-ts/adapter-node-pg

This adapter wires `pg`’s standard `Client`/`Pool` APIs to `@rawsql-ts/testkit-postgres`. It exposes the familiar helpers (`createPgTestkitClient`, `createPgTestkitPool`, `wrapPgClient`) while delegating all rewriting/fixture behavior to the driver-agnostic package.

## Installation

```bash
pnpm add -D @rawsql-ts/adapter-node-pg pg
```

`@rawsql-ts/testkit-postgres` is a hard dependency of this adapter, so it is installed automatically.

## API highlights

- `createPgTestkitClient(options)` – lazily opens a `pg` connection, rewrites CRUD queries using fixtures, and returns a facade that behaves like `pg.Client`.
- `createPgTestkitPool(connectionString, ...fixtures, options?)` – builds a `pg.Pool` whose client constructor is replaced with the pg-testkit client so transactions still execute on the raw driver.
- `wrapPgClient(client, options)` – wraps any existing `pg.Client` or `pg.Pool` instance so queries flow through fixtures without touching your schema.

Each helper accepts the same fixture configuration as before (`tableDefinitions`, `tableRows`, `ddl`, `missingFixtureStrategy`, etc.) and passes `onExecute` hooks through to `@rawsql-ts/testkit-postgres`.

## Fixtures and validation

This adapter reuses the `resolveFixtureState` and `validateFixtureRowsAgainstTableDefinitions` helpers from `@rawsql-ts/testkit-postgres`, so all adapters share the same schema snapshot and diagnostics.

## Testing

The integration tests run against a Dockerized Postgres instance via `@testcontainers/postgresql`. Run `pnpm --filter @rawsql-ts/adapter-node-pg test` to exercise the pool/client/wrapper helpers. Ensure Docker is running before executing the suite.
