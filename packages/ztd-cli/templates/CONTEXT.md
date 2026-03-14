# Agent Context

- Prefer `ztd --output json` in automation.
- Treat this file as a high-level index only; rely on subtree `AGENTS.md` files for path-specific rules.
- Prefer `ztd model-gen --probe-mode ztd` during the inner loop when local DDL is the source of truth.
- Use `--dry-run` before file-writing commands when you need a safe validation pass.
- Keep `ztd/ddl` as the human-owned schema source of truth.
- Regenerate `tests/generated/*` with `ztd ztd-config`; do not edit generated files manually.
- `ztd-cli` implicitly uses only `ZTD_TEST_DATABASE_URL`; it does not read `DATABASE_URL` automatically.
- Treat `ddl pull` and `ddl diff` as explicit target inspection commands. Pass `--url` or a complete `--db-*` flag set when using them.
- Keep transport, application, and domain work free from direct ZTD assumptions unless you are editing persistence infrastructure.
