# @rawsql-ts/ddl-docs-vitepress

## 0.2.4

### Patch Changes

- Updated dependencies [[`bb53286`](https://github.com/mk3008/rawsql-ts/commit/bb53286ccd4379b5676b790314616049357e0f51), [`a4ba2d9`](https://github.com/mk3008/rawsql-ts/commit/a4ba2d969133fecb031626aab88488cf052c5df7), [`4812f79`](https://github.com/mk3008/rawsql-ts/commit/4812f7944e49d61bcd68da8b423e668065e8f942), [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b), [`a707e04`](https://github.com/mk3008/rawsql-ts/commit/a707e0496f9079a862b40cbbdd01ba115d8d448f), [`8cb8f26`](https://github.com/mk3008/rawsql-ts/commit/8cb8f260274840f0c382cacad07579d13adf1a73), [`eaa85f7`](https://github.com/mk3008/rawsql-ts/commit/eaa85f764d1f952560407c22dd2c91c18647d9c0), [`c1b5a92`](https://github.com/mk3008/rawsql-ts/commit/c1b5a924f03a0bb67c289a23779262730bc2ef99), [`042535b`](https://github.com/mk3008/rawsql-ts/commit/042535bdce0122a61bedcf56fa8dbfe4b4d4f6e6), [`83822ad`](https://github.com/mk3008/rawsql-ts/commit/83822ad65ee5f7bbfb46019876bd2a757c68e44e), [`40a941a`](https://github.com/mk3008/rawsql-ts/commit/40a941ae3cedeca75f84f7e1af2343dc99a12f78)]:
  - @rawsql-ts/ddl-docs-cli@0.3.0

## 0.2.3

### Patch Changes

- [#634](https://github.com/mk3008/rawsql-ts/pull/634) [`d0c63f2`](https://github.com/mk3008/rawsql-ts/commit/d0c63f22298f8ec1aa6e23d783e986c07cf0285d) Thanks [@mk3008](https://github.com/mk3008)! - Add repository metadata to the ddl-docs packages so npm Trusted Publishing provenance validation can verify the package source during release.

- Updated dependencies [[`d0c63f2`](https://github.com/mk3008/rawsql-ts/commit/d0c63f22298f8ec1aa6e23d783e986c07cf0285d)]:
  - @rawsql-ts/ddl-docs-cli@0.2.4

## 0.2.2

### Patch Changes

- [#628](https://github.com/mk3008/rawsql-ts/pull/628) [`5d15113`](https://github.com/mk3008/rawsql-ts/commit/5d151130b492b0bfbb787a1410ceb1eeee0683e6) Thanks [@mk3008](https://github.com/mk3008)! - Replace workspace-only dependency ranges in published package manifests with publishable semver ranges so standalone consumers can install these packages without workspace resolution errors.

- Updated dependencies [[`5d15113`](https://github.com/mk3008/rawsql-ts/commit/5d151130b492b0bfbb787a1410ceb1eeee0683e6)]:
  - @rawsql-ts/ddl-docs-cli@0.2.3

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
