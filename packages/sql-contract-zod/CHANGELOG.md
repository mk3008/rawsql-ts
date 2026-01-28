# @rawsql-ts/sql-contract-zod

## 0.1.0

### Minor Changes

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`3582933`](https://github.com/mk3008/rawsql-ts/commit/3582933a9aec39c4932a6941b5a1c450e0ebc6b4) Thanks [@mk3008](https://github.com/mk3008)! - Expose the Zod reader helpers via the mapper augmentation so IDEs and downstream code can call mapper.zod(...) without TypeScript errors and keep the bundled dist output in sync.

### Patch Changes

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`ace9392`](https://github.com/mk3008/rawsql-ts/commit/ace9392ff13bb099bd995b994025c1285430c580) Thanks [@mk3008](https://github.com/mk3008)! - Document that the base mapper now offers a `createReader` helper (defaulting to `mapperPresets.appLike()`) and a `createWriter` alias, and keep the Zod README/tests aligned with those helpers.

- [#418](https://github.com/mk3008/rawsql-ts/pull/418) [`df60751`](https://github.com/mk3008/rawsql-ts/commit/df60751c0beb21a1fdc96254c624894f932c86cd) Thanks [@mk3008](https://github.com/mk3008)! - Document that queryZod/queryOneZod always normalize params to an array and update the related tests so the new behavior is captured.

- Updated dependencies [[`ace9392`](https://github.com/mk3008/rawsql-ts/commit/ace9392ff13bb099bd995b994025c1285430c580), [`3582933`](https://github.com/mk3008/rawsql-ts/commit/3582933a9aec39c4932a6941b5a1c450e0ebc6b4), [`df60751`](https://github.com/mk3008/rawsql-ts/commit/df60751c0beb21a1fdc96254c624894f932c86cd), [`7948db3`](https://github.com/mk3008/rawsql-ts/commit/7948db34b4b09338abd3c4ae7c99ea9398f6eefc), [`620d0a0`](https://github.com/mk3008/rawsql-ts/commit/620d0a07740c772217c938869a99019106651f13), [`20e9f27`](https://github.com/mk3008/rawsql-ts/commit/20e9f27ec47a38844e0c16c5a4d8a041eca17350), [`c26d356`](https://github.com/mk3008/rawsql-ts/commit/c26d35698632e4dbeb6cbb43b2e184d417028eef), [`92b0c8b`](https://github.com/mk3008/rawsql-ts/commit/92b0c8b33a205ccd9a0928e432a339a6c6c5de16), [`c26d356`](https://github.com/mk3008/rawsql-ts/commit/c26d35698632e4dbeb6cbb43b2e184d417028eef), [`404bad0`](https://github.com/mk3008/rawsql-ts/commit/404bad0c15024e3d78e8981a43e58578ef69b167)]:
  - @rawsql-ts/sql-contract@0.1.0
