# @rawsql-ts/sql-contract

## 0.2.0

### Minor Changes

- [#426](https://github.com/mk3008/rawsql-ts/pull/426) [`47f9e41`](https://github.com/mk3008/rawsql-ts/commit/47f9e41201f88f7b378301b474e8cbc0a1b050c8) Thanks [@mk3008](https://github.com/mk3008)! - Add reader validation hooks and scalar query helpers to support runtime DTO validation and single-value results.

- [#433](https://github.com/mk3008/rawsql-ts/pull/433) [`06ec7ea`](https://github.com/mk3008/rawsql-ts/commit/06ec7ea2c54b9561ff74cbbd6c13d8cc7ef6f9dc) Thanks [@mk3008](https://github.com/mk3008)! - Add a new public `timestampFromDriver(value, fieldName?)` helper in `@rawsql-ts/sql-contract` for fail-fast `Date | string` normalization of driver-returned timestamps.

  Update `@rawsql-ts/ztd-cli` templates to normalize runtime timestamp fields through the shared sql-contract helper (via runtime coercion wiring), add strict guardrails against local timestamp re-implementation, and expand scaffold smoke validation tests for valid and invalid timestamp strings.

### Patch Changes

- [#431](https://github.com/mk3008/rawsql-ts/pull/431) [`eadb311`](https://github.com/mk3008/rawsql-ts/commit/eadb311dcc8c748fcdd30f2b743648783aafc2f6) Thanks [@mk3008](https://github.com/mk3008)! - Corrected the catalog executor test expectations so the cached SQL loader matches the returned rows and keeps the rewrite/binder pipeline aligned.

- [#430](https://github.com/mk3008/rawsql-ts/pull/430) [`0b34920`](https://github.com/mk3008/rawsql-ts/commit/0b34920094c3451dd1263a25b44acf729fe1afae) Thanks [@mk3008](https://github.com/mk3008)! - Describe how composite and derived key normalization now exposes deterministic internals and tests can assert separator/tag/order invariants.

- [#426](https://github.com/mk3008/rawsql-ts/pull/426) [`c0486d6`](https://github.com/mk3008/rawsql-ts/commit/c0486d68a5c517efa5a511a2ea49cdc3b21986d4) Thanks [@mk3008](https://github.com/mk3008)! - - split the Postgres validator demo into five short README-ready test files that share a pg-test helper and keep the API story tidy.
  - document that the SQL Contract package now exposes `decimalStringToNumberUnsafe` for the Zod demo without importing `sql-contract-zod`, preserving a dependency-free core surface.

- [#432](https://github.com/mk3008/rawsql-ts/pull/432) [`5e01f8e`](https://github.com/mk3008/rawsql-ts/commit/5e01f8eb64894b4aea3b47aa96ccfd8a3b8ccdc3) Thanks [@mk3008](https://github.com/mk3008)! - - tighten catalog executor contracts, add `ContractViolationError`, and improve observability/error classification.

## 0.1.0

### Minor Changes

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`3582933`](https://github.com/mk3008/rawsql-ts/commit/3582933a9aec39c4932a6941b5a1c450e0ebc6b4) Thanks [@mk3008](https://github.com/mk3008)! - Expose the Zod reader helpers via the mapper augmentation so IDEs and downstream code can call mapper.zod(...) without TypeScript errors and keep the bundled dist output in sync.

- [#415](https://github.com/mk3008/rawsql-ts/pull/415) [`620d0a0`](https://github.com/mk3008/rawsql-ts/commit/620d0a07740c772217c938869a99019106651f13) Thanks [@mk3008](https://github.com/mk3008)! - Document and expose an optional `returning` setting on the writer helpers so callers can append deterministic `RETURNING` clauses without altering placeholder numbering.

- [#413](https://github.com/mk3008/rawsql-ts/pull/413) [`c26d356`](https://github.com/mk3008/rawsql-ts/commit/c26d35698632e4dbeb6cbb43b2e184d417028eef) Thanks [@mk3008](https://github.com/mk3008)! - Merge the mapper and writer cores into the new `@rawsql-ts/sql-contract` package so clients can import both mapper helpers and writer helpers from a single contract package. Update docs/tests to reference the merged entry point.

- [#413](https://github.com/mk3008/rawsql-ts/pull/413) [`92b0c8b`](https://github.com/mk3008/rawsql-ts/commit/92b0c8b33a205ccd9a0928e432a339a6c6c5de16) Thanks [@mk3008](https://github.com/mk3008)! - - Add placeholder style configuration (indexed, question, named) to the writer so callers can match sqlformatter tokens while keeping deterministic numbering, and document that the mapper integration suites now cover Postgres, MySQL, SQL Server, and SQLite against the new driver dependencies.

### Patch Changes

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`ace9392`](https://github.com/mk3008/rawsql-ts/commit/ace9392ff13bb099bd995b994025c1285430c580) Thanks [@mk3008](https://github.com/mk3008)! - Document that the base mapper now offers a `createReader` helper (defaulting to `mapperPresets.appLike()`) and a `createWriter` alias, and keep the Zod README/tests aligned with those helpers.

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`df60751`](https://github.com/mk3008/rawsql-ts/commit/df60751c0beb21a1fdc96254c624894f932c86cd) Thanks [@mk3008](https://github.com/mk3008)! - Document that queryZod/queryOneZod always normalize params to an array and update the related tests so the new behavior is captured.

- [`7948db3`](https://github.com/mk3008/rawsql-ts/commit/7948db34b4b09338abd3c4ae7c99ea9398f6eefc) Thanks [@mk3008](https://github.com/mk3008)! - Documented and implemented preset-driven writer configuration, shared `QueryParams`, and mapper preset naming updates so the new builder/executor flow works with indexed/anonymous/named placeholders.

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`20e9f27`](https://github.com/mk3008/rawsql-ts/commit/20e9f27ec47a38844e0c16c5a4d8a041eca17350) Thanks [@mk3008](https://github.com/mk3008)! - - Rename the `entity()` helper to the more descriptive `rowMapping()` alias and keep `entity()` as a deprecated forwarding helper.

- [#413](https://github.com/mk3008/rawsql-ts/pull/413) [`c26d356`](https://github.com/mk3008/rawsql-ts/commit/c26d35698632e4dbeb6cbb43b2e184d417028eef) Thanks [@mk3008](https://github.com/mk3008)! - Clarify the writer helpers by documenting allowUnsafe handling, deterministic order, and name-sorted WHERE clause building, and refresh the mapper coercion notes for API clarity.

- [#405](https://github.com/mk3008/rawsql-ts/pull/405) [`404bad0`](https://github.com/mk3008/rawsql-ts/commit/404bad0c15024e3d78e8981a43e58578ef69b167) Thanks [@mk3008](https://github.com/mk3008)! - Stabilize the pg mapper timestamp test by comparing local Date values via getTime so it no longer depends on the host time zone.
