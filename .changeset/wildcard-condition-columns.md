---
"rawsql-ts": patch
---

Improve safe condition placement through wildcard CTE and derived-table outputs when the referenced column maps to a single upstream source column, while keeping schema-unknown wildcard UNION ordinals on the safe skip path.
