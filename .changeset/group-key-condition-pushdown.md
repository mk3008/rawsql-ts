---
"rawsql-ts": patch
---

Allow condition optimization to move safe GROUP BY key predicates into grouped CTEs and derived tables while keeping aggregate-result predicates outside the pre-aggregation WHERE clause. Predicate placement now also reuses select-output wildcard inference so single-source wildcard wrapper queries can receive predicates without crossing aggregate boundaries.
