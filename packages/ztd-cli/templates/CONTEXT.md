# Agent Context

- Treat this file as a high-level index only.
- Start with `ztd init --starter` for the first run, then read the nearest `AGENTS.md` files for path-specific rules.
- Use `src/features/smoke` as the first green path and `src/features/users` as the next tutorial feature.
- Prefer `ztd model-gen --probe-mode ztd` when local DDL is the source of truth.
- Use `--dry-run` before file-writing commands when you need a safe validation pass.
- Keep `db/ddl` as the human-owned schema source of truth.
- Regenerate `.ztd/generated/*` with `ztd ztd-config`; do not edit generated files manually.
- In the starter flow, `.env` owns `ZTD_DB_HOST`, `ZTD_DB_PORT`, `ZTD_DB_NAME`, `ZTD_DB_USER`, and `ZTD_DB_PASS`; `ZTD_TEST_DATABASE_URL` is derived from those values.
- Treat `ddl pull` and `ddl diff` as explicit target inspection commands.
