# Package Scope
- Applies to `packages/adapters/adapter-node-pg`.
- Connects `@rawsql-ts/testkit-postgres` rewrite flow to Node `pg` clients and pools.
- Preserves compatibility helpers for existing adapter consumers.

# Policy
## REQUIRED
- Adapter query interception MUST route through `@rawsql-ts/testkit-postgres` rewrite flow.
- Adapter behavior MUST preserve fixture and diagnostics options when forwarding to core helpers.
- Integration tests MUST verify behavior with real PostgreSQL clients/pools.

## ALLOWED
- Legacy helper APIs MAY remain for backward compatibility.

## PROHIBITED
- Implementing rewrite logic inside the adapter package.
- Bypassing fixture/DDL validation enforced by core helpers.
- Duplicating shared executor abstraction behavior.

# Mandatory Workflow
- Before committing changes under `packages/adapters/adapter-node-pg`, run:
  - `pnpm --filter @rawsql-ts/adapter-node-pg lint`
  - `pnpm --filter @rawsql-ts/adapter-node-pg test`
  - `pnpm --filter @rawsql-ts/adapter-node-pg build`

# Hygiene
- Temporary diagnostics and debug logs MUST be removed before commit.

# References
- Parent policy context: [../../../AGENTS.md](../../../AGENTS.md)
- Postgres helper contract: [../../testkit-postgres/AGENTS.md](../../testkit-postgres/AGENTS.md)
