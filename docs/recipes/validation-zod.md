---
title: Validation recipe (Zod)
---

# Validation recipe (Zod)

ZTD init defaults to the runtime-free path and does not install a runtime row validator.

Use Zod at application input/output boundaries when a project needs request or DTO validation.
Do not add `@rawsql-ts/sql-contract` for generated SQL row mapping; that package has been removed.

For generated query boundaries, prefer:

- Zod request parsing at the boundary when input validation is needed.
- AOT row mappers for DB rows.
- ZTD-backed tests for SQL and mapper behavior.

If a legacy project still needs runtime row validation, keep that compatibility code local until it moves to an explicit advanced runtime package.
