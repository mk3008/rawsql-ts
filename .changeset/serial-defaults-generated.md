---
"rawsql-ts": patch
---

Ensure serial/serial8 pseudo-types are normalized before casts and that columns without explicit defaults get a deterministic `row_number() over ()` expression so RETURNING clauses work when the column is omitted.
