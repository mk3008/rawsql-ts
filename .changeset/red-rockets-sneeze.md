---
'@rawsql-ts/ztd-cli': minor
---

Add a local-source dogfooding mode to `ztd init` via `--local-source-root`.

The new mode links `@rawsql-ts/sql-contract` from a local monorepo path, emits `src/local/sql-contract.ts`, and switches the scaffold runtime coercion import to the local shim so a fresh project under `tmp/` can reach `pnpm install`, `pnpm typecheck`, and the template smoke tests without published rawsql-ts packages.
