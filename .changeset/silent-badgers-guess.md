---
"@rawsql-ts/ztd-cli": patch
---

Fix feature scaffold queryspec generation so CRUD baselines no longer import non-existent `sql-contract` cardinality helpers and instead use locally generated row-count handling.
