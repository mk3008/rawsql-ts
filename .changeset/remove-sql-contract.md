---
"@rawsql-ts/ztd-cli": patch
"@rawsql-ts/testkit-postgres": patch
"@rawsql-ts/adapter-node-pg": patch
"@rawsql-ts/advanced-runtime": minor
---

Remove the workspace `@rawsql-ts/sql-contract` package from the standard runtime path.

`ztd-cli` generated query paths now continue toward runtime-free execution with thin executor calls and AOT generated row mappers. `testkit-postgres` now owns its small query-result normalization shape directly, and the node-pg adapter build no longer depends on the removed package.
