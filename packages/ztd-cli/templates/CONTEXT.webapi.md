# Agent Context

- Treat this file as a top-level index for the layered WebAPI layout.
- Keep `src/domain`, `src/application`, and `src/presentation/http` free from direct ZTD assumptions.
- Apply ZTD-specific workflow rules only inside `src/infrastructure/persistence`, `src/sql`, `src/catalog`, and `ztd`.
- Prefer `ztd model-gen --probe-mode ztd` during the inner loop when local DDL is the source of truth.
- Use `--dry-run` before file-writing commands when you need a safe validation pass.
- Keep `ztd/ddl` as the human-owned schema source of truth.
- Regenerate `tests/generated/*` with `ztd ztd-config`; do not edit generated files manually.
