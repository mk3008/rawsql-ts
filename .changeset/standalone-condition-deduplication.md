---
"rawsql-ts": patch
---

Run condition deduplication as a standalone condition optimization phase so identical top-level AND predicates can be removed even when no condition placement move occurs.
