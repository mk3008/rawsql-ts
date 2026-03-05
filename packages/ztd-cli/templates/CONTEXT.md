# Agent Context

- Prefer `ztd --output json` in automation.
- Prefer `ztd model-gen --probe-mode ztd` during the inner loop when local DDL is the source of truth.
- Use `--dry-run` before file-writing commands when you need a safe validation pass.
- Keep `ztd/ddl` as the human-owned schema source of truth.
- Regenerate `tests/generated/*` with `ztd ztd-config`; do not edit generated files manually.
