# @rawsql-ts/ddl-docs-cli

## 2.0.0

### Patch Changes

- Updated dependencies []:
  - rawsql-ts@2.0.0

## 0.2.2

### Patch Changes

- Updated dependencies [[`b56a3fa`](https://github.com/mk3008/rawsql-ts/commit/b56a3fa82763c4120f73b2cec9f295c55c951609)]:
  - rawsql-ts@0.17.0

## 0.2.1

### Patch Changes

- [#513](https://github.com/mk3008/rawsql-ts/pull/513) [`f0c1c32`](https://github.com/mk3008/rawsql-ts/commit/f0c1c327fe8e0f4cc917d0c2d8013391bdd9185d) Thanks [@mk3008](https://github.com/mk3008)! - Fix the published CLI entrypoint metadata so the package points at the generated dist/src/index.js output.

  This keeps local pack and publish flows from failing in prepack after a successful build.

## 0.2.0

### Minor Changes

- [#449](https://github.com/mk3008/rawsql-ts/pull/449) [`e960404`](https://github.com/mk3008/rawsql-ts/commit/e96040413ce357c0c86fe87f886b9d8cce6cb44e) Thanks [@mk3008](https://github.com/mk3008)! - Add a new `@rawsql-ts/ddl-docs-cli` package that generates schema/table Markdown documentation from DDL files using rawsql-ts parsing.

- [#453](https://github.com/mk3008/rawsql-ts/pull/453) [`9f333e5`](https://github.com/mk3008/rawsql-ts/commit/9f333e5f7a686b3d0e469508cb0a3a9b2486d895) Thanks [@mk3008](https://github.com/mk3008)! - Add a new "filter pg_dump" workflow for DDL docs generation and introduce a publishable VitePress scaffold CLI.

  `@rawsql-ts/ddl-docs-cli` now supports `--filter-pg-dump` for `generate`, which strips administrative pg_dump statements (for example GRANT/REVOKE, OWNER changes, SET, and `\connect`) before parsing.

  `@rawsql-ts/ddl-docs-vitepress` is now packaged as a scaffold generator with `ddl-docs-vitepress init`. The init flow is safe by default, supports overwrite-only mode with `--force`, explicit destructive cleanup with `--force --clean`, and improved help output via `help`, `--help`, and `init --help`.

### Patch Changes

- Updated dependencies [[`e960404`](https://github.com/mk3008/rawsql-ts/commit/e96040413ce357c0c86fe87f886b9d8cce6cb44e)]:
  - rawsql-ts@0.16.1

## 0.1.0

- Initial release of the DDL-to-Markdown documentation CLI.
