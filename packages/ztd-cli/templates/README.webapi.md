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
- `tests`: smoke tests and test support

Prompt dogfooding:
- See `PROMPT_DOGFOOD.md` when you want to verify that generic WebAPI requests stay out of persistence-specific ZTD guidance unless repository or SQL work is explicitly requested.

Next steps:
1. Update `ztd/ddl/<schema>.sql` if needed.
2. Run `npx ztd ztd-config`.
3. Keep `src/domain`, `src/application`, and `src/presentation/http` free from direct SQL or DDL concerns.
4. Use `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` when you want a QuerySpec scaffold from the local DDL snapshot.
5. Wire repositories to `src/infrastructure/telemetry/repositoryTelemetry.ts` only when you add SQL-backed repository classes.
6. Provide a SqlClient implementation in `src/infrastructure/db`.
7. Run tests (`npm run test` or `npx vitest run`) with `ZTD_TEST_DATABASE_URL` when SQL-backed verification needs a managed test database.
8. Treat `ddl pull` and `ddl diff` as explicit target inspection commands that require `--url` or a complete `--db-*` flag set.
9. If you generate migration SQL artifacts, apply them outside `ztd-cli`.

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, first run `pnpm install` (or `pnpm install --ignore-workspace` when nested under another `pnpm-workspace.yaml`), then `pnpm typecheck`, then `pnpm test`, then `pnpm ztd ztd-config`. The scaffold keeps `@rawsql-ts/sql-contract` as a normal package import even in local-source developer mode.
