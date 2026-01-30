---
"@rawsql-ts/sql-contract": patch
"@rawsql-ts/sql-contract-zod": patch
---

- split the Postgres validator demo into five short README-ready test files that share a pg-test helper and keep the API story tidy.
- document that the SQL Contract package now exposes `decimalStringToNumberUnsafe` for the Zod demo without importing `sql-contract-zod`, preserving a dependency-free core surface.
