---
"rawsql-ts": patch
---

Fix SSSQL optional-condition planning for queries with CTE-local WHERE clauses and casted null guards.

The SSSQL planner now inserts new root-query optional filters into the root WHERE clause instead of the first WHERE found inside a CTE. Optional-condition recognition also supports null guards written as `:param::type IS NULL` and `CAST(:param AS type) IS NULL`, including multi-predicate branches that use the same parameter.
