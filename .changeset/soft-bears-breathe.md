---
"@rawsql-ts/ztd-cli": patch
"@rawsql-ts/testkit-core": patch
---

`ztd-config` now reuses shared DDL analysis for linting and table metadata generation, and skips no-op config writes so telemetry matches actual persistence.
