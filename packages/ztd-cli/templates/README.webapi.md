# Zero Table Dependency WebAPI Project

This scaffold separates WebAPI concerns into explicit layers so transport and use-case work do not accidentally inherit persistence-specific rules.

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
2. Run `pnpm exec ztd ztd-config` (or `npx ztd ztd-config` if you prefer npm-style invocation).
3. Keep `src/domain`, `src/application`, and `src/presentation/http` free from direct SQL or DDL concerns.
4. Use `pnpm exec ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` when you want a QuerySpec scaffold from the local DDL snapshot.
5. Wire repositories to `src/infrastructure/telemetry/repositoryTelemetry.ts` only when you add SQL-backed repository classes.
6. Provide a SqlClient implementation in `src/infrastructure/db`.
7. Run tests (`pnpm test` or `npx vitest run`).

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, first run `pnpm install` (or `pnpm install --ignore-workspace` when nested under another `pnpm-workspace.yaml`), then `pnpm typecheck`, then `pnpm test`, then `pnpm ztd ztd-config`. For generated QuerySpecs, prefer `pnpm ztd model-gen --probe-mode ztd --import-style relative` so imports keep using the local shim.
