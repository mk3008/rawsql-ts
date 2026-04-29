---
"@rawsql-ts/ztd-cli": patch
---

Document the RFBA feature/query test lane split in the canonical guide and generated scaffold guidance.

The generated guidance now makes feature-boundary tests mock child query boundaries for validation, mapping, and orchestration, while query-boundary tests own SQL behavior through ZTD or another SQL-specific lane. It also clarifies that `src/libraries/` is only for driver-neutral code reusable enough to stand as an external package, not feature-specific validation or helpers.
