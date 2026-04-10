---
"@rawsql-ts/ztd-cli": minor
"rawsql-ts": minor
---

Add `ztd feature query scaffold` for creating child query boundaries under an existing boundary without rewriting the parent boundary.

Promote `--scope-dir` as the primary `ztd query uses` narrowing flag while keeping `--specs-dir` as a deprecated compatibility alias.

Support `MERGE ... RETURNING` as a writable CTE output shape in `rawsql-ts` so downstream SELECT and CTE analysis can resolve returned columns consistently across supported DML forms.
