# Zero Table Dependency WebAPI Project

This scaffold separates WebAPI concerns into explicit layers so transport and use-case work do not accidentally inherit persistence-specific rules.

Conceptual model:
- `ztd-cli` implicitly uses only `ZTD_TEST_DATABASE_URL`.
- Projects often also have a runtime or deployment database setting such as `DATABASE_URL`, but `ztd-cli` does not read it automatically.
- Any non-ZTD database target must be passed explicitly via `--url` or `--db-*`.
- `ztd-cli` may generate migration SQL artifacts, but it does not apply them.

Quick boundary table:
- `ZTD_TEST_DATABASE_URL`: owned by `ztd-cli` for ZTD tests and verification
- `DATABASE_URL`: runtime or deployment concern, not read automatically by `ztd-cli`
- `--url` / complete `--db-*`: explicit target inspection only

Key folders:
- `src/domain`: domain types and business rules with no direct ZTD dependency
- `src/application`: use cases and orchestration over domain-facing ports
- `src/presentation/http`: HTTP handlers, request parsing, and response shaping
- `src/infrastructure/persistence`: repositories, SQL assets, and QuerySpec wiring
- `src/sql`, `src/catalog`, `ztd/ddl`: ZTD-owned persistence assets
- `tests`: smoke tests, support files, and the QuerySpec-first example sample

Prompt dogfooding:
- See `PROMPT_DOGFOOD.md` when you want to verify that generic WebAPI requests stay out of persistence-specific ZTD guidance unless repository or SQL work is explicitly requested.

Next steps:
1. Update `ztd/ddl/<schema>.sql` if needed.
2. Add or edit your first SQL asset under `src/sql/`, while keeping `src/domain`, `src/application`, and `src/presentation/http` free from direct SQL or DDL concerns.
3. Run `npx ztd ztd-config` to regenerate DDL-derived test rows and layout metadata.
4. Run `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` to scaffold a QuerySpec from that SQL file.
5. Review `src/catalog/specs/_smoke.spec.ts`, `tests/queryspec.example.test.ts`, and `src/infrastructure/db/sql-client.ts` so the first SQL-backed repository has both a minimal gate and a QuerySpec-first sample to copy.
6. Run tests (`npm run test` or `npx vitest run`) to pass the generated smoke test before adding SQL-backed coverage.

If this fails:
- If `npx ztd ztd-config` fails, keep editing `ztd/ddl/<schema>.sql` and `src/sql/` first, then rerun generation after the DDL is ready.
- If `npx ztd model-gen` fails, keep the SQL file and rerun it after `npx ztd ztd-config` succeeds; the `ztd` probe path does not need `DATABASE_URL`.
- If you do not have `ZTD_TEST_DATABASE_URL` yet, use the generated smoke test as the first DB-free pass and wait to add SQL-backed tests until the connection is ready.
- If you want the repository-test sample that mirrors the first SQL-backed workflow, start from `tests/queryspec.example.test.ts`.
- Treat `ddl pull` and `ddl diff` as explicit target inspection commands that require `--url` or a complete `--db-*` flag set.
- If you generate migration SQL artifacts, apply them outside `ztd-cli`.

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, first run `pnpm install` (or `pnpm install --ignore-workspace` when nested under another `pnpm-workspace.yaml`), then `pnpm typecheck`, then `pnpm test`, then `pnpm ztd ztd-config`. The scaffold keeps `@rawsql-ts/sql-contract` as a normal package import even in local-source developer mode.
