---
"rawsql-ts": minor
---

Fix DDL fixture generation to honor column defaults defined via ALTER TABLE.

Column defaults set with `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT ...` are now applied when deriving fixtures from DDL.
Defaults added outside `CREATE TABLE`, including sequence-backed values like `nextval(...)` and non-sequence defaults such as `now()`, are correctly reflected in column metadata and used for omitted INSERT values.
