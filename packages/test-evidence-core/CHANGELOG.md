# @rawsql-ts/test-evidence-core

## 0.2.0

### Minor Changes

- [#451](https://github.com/mk3008/rawsql-ts/pull/451) [`40c4d82`](https://github.com/mk3008/rawsql-ts/commit/40c4d8259b8808a25dc77b61fa3fd324856a80b8) Thanks [@mk3008](https://github.com/mk3008)! - Keep deterministic test-evidence semantic transforms in @rawsql-ts/test-evidence-core and add a pure buildSpecificationModel intermediate model API with schemaVersion validation and typed deterministic errors.

  Add @rawsql-ts/test-evidence-renderer-md for markdown projection only, then update @rawsql-ts/ztd-cli to consume core semantics and renderer projections via explicit boundaries.

### Patch Changes

- [#506](https://github.com/mk3008/rawsql-ts/pull/506) [`1cb9aef`](https://github.com/mk3008/rawsql-ts/commit/1cb9aef7402d00f19a8bebe416f845b9efd36a88) Thanks [@mk3008](https://github.com/mk3008)! - Clarify published vs local-source dogfooding, ensure fresh `ztd init` installs scaffold dependencies, inline scaffold timestamp coercions so generated smoke tests run against the published sql-contract package, make `serial8` DDL mapping generate stable numeric types, align release verification with `pnpm pack/publish` so workspace dependencies are rewritten consistently, and add a repository-root published-package smoke check that packs internal tarballs and reuses them via local overrides before release. Publish `@rawsql-ts/shared-binder`, `@rawsql-ts/test-evidence-core`, and `@rawsql-ts/test-evidence-renderer-md` so released packages can resolve their runtime evidence and binder dependencies.

- [#451](https://github.com/mk3008/rawsql-ts/pull/451) [`ea03f55`](https://github.com/mk3008/rawsql-ts/commit/ea03f55a6dad7e61f737da453256bde64454442e) Thanks [@mk3008](https://github.com/mk3008)! - Refine unit test specification markdown for review readability with flattened headings, strict two-axis tags, consistent focus phrasing, and catalog/case-level refs. Enforce throws error block rendering and deterministic metadata ordering.
