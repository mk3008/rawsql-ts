# Zero Table Dependency Project

This project uses Zero Table Dependency (ZTD) to keep SQL, DDL, and tests aligned.

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
7. Apply the schema to a live database only when you need live-schema helpers such as `ztd model-gen --probe-mode live`, `ztd ddl pull`, or `ztd ddl diff`.

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
