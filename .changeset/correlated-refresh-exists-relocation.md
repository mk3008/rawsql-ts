---
"rawsql-ts": minor
"@rawsql-ts/ztd-cli": minor
---

Improve SSSQL `refresh` so correlated `EXISTS` / `NOT EXISTS` branches can be safely re-anchored after query structure changes.

`rawsql-ts` now relocates correlated optional branches by inferring a single anchor from outer references, rebases aliases when moving branches across query scopes, and fails fast when anchor inference is missing or ambiguous.

`@rawsql-ts/ztd-cli` adds regression coverage for correlated `refresh` round-trips and `remove --all` interoperability so SQL-first optional branch maintenance stays deterministic after scaffolding.
