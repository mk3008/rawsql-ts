---
"@rawsql-ts/testkit-core": minor
"@rawsql-ts/testkit-postgres": minor
---

Add DDL-derived view support for fixture-backed SELECT rewriting.

Normal `CREATE VIEW` definitions discovered from configured DDL files can now be expanded into view-name CTE shadows, allowing queries against supported views to run against the same base table fixtures used by Zero Table Dependency tests. Materialized, recursive, malformed, and cyclic view definitions fail with explicit unsupported errors.
