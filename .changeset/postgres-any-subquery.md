---
"rawsql-ts": patch
---

Parse PostgreSQL quantified comparisons such as `= ANY (SELECT ...)`, `= SOME (SELECT ...)`, and `<> ALL (SELECT ...)` while preserving existing array-style forms like `= ANY (:ids)`.
