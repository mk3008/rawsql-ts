---
'@rawsql-ts/sql-contract': patch
'@rawsql-ts/sql-contract-zod': patch
---
Document that the base mapper now offers a `createReader` helper (defaulting to `mapperPresets.appLike()`) and a `createWriter` alias, and keep the Zod README/tests aligned with those helpers.
