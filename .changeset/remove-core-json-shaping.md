---
"rawsql-ts": minor
---

Remove SQL-result JSON shaping APIs from core.

`PostgresJsonQueryBuilder`, JSON mapping converters, JSON schema validation helpers, and `DynamicQueryBuilder` JSON serialization options have been removed. Keep executed SQL as ordinary row/column SQL and build response shape with generated AOT mappers so reviewed SQL and executed SQL remain debuggable.
