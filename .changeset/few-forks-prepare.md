---
"@rawsql-ts/ztd-cli": minor
---

Simplify `ztd.config.json` by removing the legacy `ddl.defaultSchema` and `ddl.searchPath` mirror.

`ztd-cli` now reads and writes schema resolution settings only from the top-level `defaultSchema` and `searchPath` fields. Projects that still keep those values under `ddl` must move them to the top level.
