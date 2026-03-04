# Local-Source Dogfooding

Use this guide when you dogfood `ztd-cli` from a throwaway project under `tmp/` while pointing every `rawsql-ts` dependency at local source instead of published npm packages.

## Recommended shape

1. Create the throwaway app under `tmp/` so it stays outside normal git tracking.
2. Scaffold with `ztd init --local-source-root <monorepo-root>` so the first install links `@rawsql-ts/sql-contract` from local source instead of npm.
3. Keep your DDL under `ztd/ddl/*.sql` and prefer `ztd model-gen --probe-mode ztd` during the inner loop.
4. For generated QuerySpecs, prefer `--import-style relative` or `--import-from src/local/sql-contract.ts`.

Example:

```bash
mkdir tmp/my-ztd-dogfood && cd tmp/my-ztd-dogfood
npx ztd init --workflow empty --validator zod --local-source-root ../../..
pnpm install --ignore-workspace
pnpm typecheck
pnpm test
```

The local-source profile rewrites `test` and `typecheck` through a guard script. If the scaffold is still resolving tools from a parent workspace, the guard prints the exact recovery commands instead of failing with a generic module-resolution error.

## pnpm workspace guard

If the throwaway project lives under another `pnpm-workspace.yaml` (for example `tmp/` inside this monorepo), plain `pnpm install` can be absorbed by the parent workspace.

Use:

```bash
pnpm install --ignore-workspace
```

`ztd init` now adds the same flag automatically for its own install step when it detects a parent pnpm workspace.

## Local-source imports for generated specs

When `model-gen` output should import a local shim instead of `@rawsql-ts/sql-contract`, pass an explicit import target:

```bash
ztd model-gen src/sql/users/list_users.sql \
  --probe-mode ztd \
  --out src/catalog/specs/generated/list-users.spec.ts \
  --import-from src/local/sql-contract.ts
```

If you prefer a relative import and your project keeps a shim at `src/local/sql-contract.ts`, you can also use:

```bash
ztd model-gen src/sql/users/list_users.sql \
  --probe-mode ztd \
  --out src/catalog/specs/generated/list-users.spec.ts \
  --import-style relative
```

## Common failure modes

- `pnpm install` links the app into a parent workspace unexpectedly.
  - Re-run with `pnpm install --ignore-workspace`.
- `model-gen --probe-mode ztd` says the DDL directory is missing.
  - Run the command from the project root that contains `ztd.config.json`, or pass `--ddl-dir`.
- Generated specs fail to typecheck because they import `@rawsql-ts/sql-contract` in a local-source dogfood app.
  - Use `--import-from` or `--import-style relative`.
- `model-gen --probe-mode live` succeeds but `--probe-mode ztd` fails.
  - Local DDL is not yet the source of truth for that query shape; either update `ztd/ddl/*.sql` or treat it as a live-schema concern.
