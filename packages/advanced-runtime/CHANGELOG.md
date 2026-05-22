# @rawsql-ts/advanced-runtime

## 0.1.0

### Minor Changes

- [#836](https://github.com/mk3008/rawsql-ts/pull/836) [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b) Thanks [@mk3008](https://github.com/mk3008)! - Remove the workspace `@rawsql-ts/sql-contract` package from the standard runtime path.

  `ztd-cli` generated query paths now continue toward runtime-free execution with thin executor calls and AOT generated row mappers. `testkit-postgres` now owns its small query-result normalization shape directly, and the node-pg adapter build no longer depends on the removed package.
