---
"rawsql-ts": minor
"@rawsql-ts/ztd-cli": minor
---

Expand SSSQL authoring and inspection across the core library and `ztd-cli`.

`ztd query sssql` now supports `list`, `remove`, `remove --all`, richer scalar operators, and structured `EXISTS` / `NOT EXISTS` scaffold input with preview-friendly rewrite flows. The CLI also fails fast when a rewrite would drop existing SQL comments.

`rawsql-ts` now exposes the branch metadata and removal helpers needed to inspect, remove, and bulk-remove recognized SSSQL branches while keeping runtime pruning explicit through `optionalConditionParameters`.
