# Package Scope
- Applies to `packages/testkit-postgres`.
- Provides Postgres-aware fixture/DDL helpers used by adapters through a driver-agnostic executor boundary.
- Exposes client-creation and fixture-state helpers without direct `pg` dependency.

# Policy
## REQUIRED
- Public API surface MUST stay independent from `pg` symbols.
- Adapter integration MUST pass a `QueryExecutor` implementation from adapter packages.
- Fixture rows MUST be validated against table definitions before executor invocation.
- Adapter wiring MUST call `createPostgresTestkitClient` using a real driver-backed executor.

## ALLOWED
- Postgres semantics MAY be represented through DDL fixture/table-name normalization behavior.

## PROHIBITED
- Importing or re-exporting `pg` types/symbols from this package.
- Managing driver connection lifecycles in this package.
- Duplicating adapter-level pool/wrapper logic.

# Mandatory Workflow
- Before committing changes under `packages/testkit-postgres`, run:
  - `pnpm --filter @rawsql-ts/testkit-postgres lint`
  - `pnpm --filter @rawsql-ts/testkit-postgres test`
  - `pnpm --filter @rawsql-ts/testkit-postgres build`

# Hygiene
- Driver-specific tests MUST remain in adapter packages.

# References
- Parent policy context: [../../AGENTS.md](../../AGENTS.md)
