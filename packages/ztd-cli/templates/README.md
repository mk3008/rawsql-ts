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
2. Add or edit your first SQL asset under `src/sql/`.
3. Run `npx ztd ztd-config` to regenerate DDL-derived test rows and layout metadata.
4. Run `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` to scaffold a QuerySpec from that SQL file.
5. Review `src/db/sql-client.ts` and `src/infrastructure/telemetry/repositoryTelemetry.ts` so the first SQL-backed repository has a seam to plug into.
6. Run tests (`npm run test` or `npx vitest run`) to pass the generated smoke test before adding SQL-backed coverage.

If this fails:
- If `npx ztd ztd-config` fails, keep editing `ztd/ddl/<schema>.sql` and `src/sql/` first, then rerun generation after the DDL is ready.
- If `npx ztd model-gen` fails, keep the SQL file and rerun it after `npx ztd ztd-config` succeeds; the `ztd` probe path does not need `DATABASE_URL`.
- If you do not have `ZTD_TEST_DATABASE_URL` yet, use the generated smoke test as the first DB-free pass and wait to add SQL-backed tests until the connection is ready.
- Use `ztd model-gen --probe-mode live`, `ztd ddl pull`, or `ztd ddl diff` only for explicit target inspection by passing `--url` or a complete `--db-*` flag set.
- If you generate migration SQL artifacts, apply them with your deployment tooling instead of `ztd-cli`.

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, first run `pnpm install` (or `pnpm install --ignore-workspace` when nested under another `pnpm-workspace.yaml`), then `pnpm typecheck`, then `pnpm test`, then `pnpm ztd ztd-config`. The scaffold keeps `@rawsql-ts/sql-contract` as a normal package import even in local-source developer mode.

For schema-change impact checks, `npx ztd query uses` defaults to the `impact` view. Table add / column add checks usually work with the default scan, while table rename / column rename / column type change checks often benefit from `--exclude-generated` so review-only specs under `src/catalog/specs/generated` do not add noise. The flag is optional and does not change the default scan set.

If you later switch this scaffold into a layered WebAPI shape, add a prompt-dogfooding guide similar to `PROMPT_DOGFOOD.md` so generic transport requests can be checked for accidental ZTD leakage.

Examples:

```bash
npx ztd query uses table public.sale_items --exclude-generated
npx ztd query uses table public.sale_lines --exclude-generated
npx ztd query uses column public.products.title --exclude-generated
npx ztd query uses column public.sale_items.quantity --exclude-generated
npx ztd query uses table public.sale_lines --view detail --exclude-generated
```
