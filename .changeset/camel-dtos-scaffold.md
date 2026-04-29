---
"@rawsql-ts/ztd-cli": minor
---

Make `ztd feature scaffold` generate camelCase feature-boundary DTOs by default while keeping query-boundary params DB-shaped.

Generated feature boundaries now map camelCase request fields to explicit snake_case query params, map DB-shaped query results back into camelCase responses, and scaffold JSON/JSONB columns as object inputs when they can be represented safely.
