---
title: Validation recipe (ArkType)
---

# Validation recipe (ArkType)

ZTD init defaults to the runtime-free path and does not install a runtime row validator.

Use ArkType at application input/output boundaries when a project needs DTO validation.
Do not add `@rawsql-ts/sql-contract` for generated SQL row mapping; that package has been removed.

For generated query boundaries, prefer:

- Boundary-local request validation when needed.
- AOT row mappers for DB rows.
- ZTD-backed tests for SQL and mapper behavior.

If a legacy project still needs runtime row validation, keep that compatibility code local until it moves to an explicit advanced runtime package.
