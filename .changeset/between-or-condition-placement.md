---
"rawsql-ts": patch
---

Move safe whole `BETWEEN` and `OR` predicates during condition placement when all referenced columns resolve to the same upstream query block.
