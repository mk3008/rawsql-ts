# Zero Table Dependency Project

This project uses Zero Table Dependency (ZTD) to keep SQL, DDL, and tests aligned.

Conceptual model:
- `ztd-cli` implicitly uses only `ZTD_TEST_DATABASE_URL`.
- `DATABASE_URL` and other runtime or deployment database settings are outside the ownership of `ztd-cli`.
- Any non-ZTD database target must be passed explicitly via `--url` or `--db-*`.
- `ztd-cli` may generate migration SQL artifacts, but it does not apply them.

Quick boundary table:
- `ZTD_TEST_DATABASE_URL`: owned by `ztd-cli` for ZTD tests and verification
- `DATABASE_URL`: runtime or deployment concern, not read automatically by `ztd-cli`
- `--url` / complete `--db-*`: explicit target inspection only

Key folders:
- ztd/ddl: schema files (source of truth)
- src: application SQL and repositories
- tests: ZTD tests and support

Next steps:
1. Update `ztd/ddl/<schema>.sql` if needed.
2. Run `pnpm exec ztd ztd-config` (or `npx ztd ztd-config` if you prefer npm-style invocation).
3. Run `pnpm exec ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` when you want a QuerySpec scaffold from the local DDL snapshot.
4. Wire repositories to `src/infrastructure/telemetry/repositoryTelemetry.ts` so application code can replace the default telemetry hook.
5. Provide a SqlClient implementation.
6. Run tests (`pnpm test` or `npx vitest run`).
7. Use `ZTD_TEST_DATABASE_URL` for ZTD-owned test and verification workflows.
8. Use `ztd model-gen --probe-mode live`, `ztd ddl pull`, or `ztd ddl diff` only for explicit target inspection by passing `--url` or a complete `--db-*` flag set.
9. If you generate migration SQL artifacts, apply them with your deployment tooling instead of `ztd-cli`.

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, first run `pnpm install` (or `pnpm install --ignore-workspace` when nested under another `pnpm-workspace.yaml`), then `pnpm typecheck`, then `pnpm test`, then `pnpm ztd ztd-config`. For generated QuerySpecs, prefer `pnpm ztd model-gen --probe-mode ztd --import-style relative` so imports keep using the local shim.

For schema-change impact checks, `npx ztd query uses` defaults to the `impact` view. Table add / column add checks usually work with the default scan, while table rename / column rename / column type change checks often benefit from `--exclude-generated` so review-only specs under `src/catalog/specs/generated` do not add noise. The flag is optional and does not change the default scan set.

If you later switch this scaffold into a layered WebAPI shape, add a prompt-dogfooding guide similar to `PROMPT_DOGFOOD.md` so generic transport requests can be checked for accidental ZTD leakage.

Examples:

```bash
pnpm exec ztd query uses table public.sale_items --exclude-generated
pnpm exec ztd query uses table public.sale_lines --exclude-generated
pnpm exec ztd query uses column public.products.title --exclude-generated
pnpm exec ztd query uses column public.sale_items.quantity --exclude-generated
pnpm exec ztd query uses table public.sale_lines --view detail --exclude-generated
```
