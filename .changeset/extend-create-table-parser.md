---
"rawsql-ts": patch
---

Allow the CreateTable parser to accept `CREATE TEMP TABLE` as a synonym for `CREATE TEMPORARY TABLE` and to retain `ON COMMIT {PRESERVE ROWS | DELETE ROWS | DROP}` options when handling PostgreSQL-style statements.
