---
'packages/core': patch
---
- Hardened the `DynamicQueryBuilder` test suite by matching specific named parameters, ORDER BY direction, and EXISTS/NOT EXISTS clause structures so the assertions remain stable regardless of formatter or error-message changes.
