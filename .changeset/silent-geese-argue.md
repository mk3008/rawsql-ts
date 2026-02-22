---
"rawsql-ts": patch
---

Add parser and formatter support for Postgres `COMMENT ON TABLE/COLUMN` statements.

- add `CommentOnStatement` and `CommentOnParser`
- route `COMMENT ON TABLE/COLUMN` in `SqlParser`
- render `CommentOnStatement` via `SqlFormatter` with identifier escaping
- add parser and formatter tests for `COMMENT ON` statements
