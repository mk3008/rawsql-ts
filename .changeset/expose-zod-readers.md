---
"@rawsql-ts/sql-contract": minor
"@rawsql-ts/sql-contract-zod": minor
---

Expose the Zod reader helpers via the mapper augmentation so IDEs and downstream code can call mapper.zod(...) without TypeScript errors and keep the bundled dist output in sync.
