---
"@rawsql-ts/ddl-docs-cli": minor
"@rawsql-ts/ddl-docs-vitepress": minor
---

Add a new "filter pg_dump" workflow for DDL docs generation and introduce a publishable VitePress scaffold CLI.

`@rawsql-ts/ddl-docs-cli` now supports `--filter-pg-dump` for `generate`, which strips administrative pg_dump statements (for example GRANT/REVOKE, OWNER changes, SET, and `\connect`) before parsing.

`@rawsql-ts/ddl-docs-vitepress` is now packaged as a scaffold generator with `ddl-docs-vitepress init`. The init flow is safe by default, supports overwrite-only mode with `--force`, explicit destructive cleanup with `--force --clean`, and improved help output via `help`, `--help`, and `init --help`.
