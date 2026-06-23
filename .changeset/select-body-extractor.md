---
"rawsql-ts": patch
---

Add `SelectBodyExtractor` for wrapper statements that contain an embedded SELECT body. It supports CREATE TABLE AS SELECT, CREATE VIEW AS SELECT, CREATE MATERIALIZED VIEW AS SELECT, and INSERT SELECT, and returns explicit unsupported results when no SELECT body is available.
