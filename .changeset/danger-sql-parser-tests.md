---
"rawsql-ts": patch
---

- Add parser regression tests for `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` so the core grammar keeps producing AST nodes that downstream guards can inspect for dangerous DDL.
