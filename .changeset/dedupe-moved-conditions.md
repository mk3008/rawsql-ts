---
"rawsql-ts": patch
---

Deduplicate identical top-level AND conditions when condition optimization moves a predicate into a WHERE or JOIN ON clause that already contains the same predicate.
