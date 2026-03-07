# @rawsql-ts/ddl-docs-vitepress

## 0.2.1

### Patch Changes

- [#513](https://github.com/mk3008/rawsql-ts/pull/513) [`f0c1c32`](https://github.com/mk3008/rawsql-ts/commit/f0c1c327fe8e0f4cc917d0c2d8013391bdd9185d) Thanks [@mk3008](https://github.com/mk3008)! - Fix the published CLI entrypoint metadata so the package points at the generated dist/src/index.js output.

  This keeps local pack and publish flows from failing in prepack after a successful build.

- Updated dependencies [[`f0c1c32`](https://github.com/mk3008/rawsql-ts/commit/f0c1c327fe8e0f4cc917d0c2d8013391bdd9185d)]:
  - @rawsql-ts/ddl-docs-cli@0.2.1

## 0.2.0

### Minor Changes

- [#453](https://github.com/mk3008/rawsql-ts/pull/453) [`9f333e5`](https://github.com/mk3008/rawsql-ts/commit/9f333e5f7a686b3d0e469508cb0a3a9b2486d895) Thanks [@mk3008](https://github.com/mk3008)! - Add a new "filter pg_dump" workflow for DDL docs generation and introduce a publishable VitePress scaffold CLI.

  `@rawsql-ts/ddl-docs-cli` now supports `--filter-pg-dump` for `generate`, which strips administrative pg_dump statements (for example GRANT/REVOKE, OWNER changes, SET, and `\connect`) before parsing.

  `@rawsql-ts/ddl-docs-vitepress` is now packaged as a scaffold generator with `ddl-docs-vitepress init`. The init flow is safe by default, supports overwrite-only mode with `--force`, explicit destructive cleanup with `--force --clean`, and improved help output via `help`, `--help`, and `init --help`.
