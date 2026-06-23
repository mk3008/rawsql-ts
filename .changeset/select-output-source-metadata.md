---
"rawsql-ts": patch
---

Include source metadata on `SelectOutputCollector` entries when wildcard expansion can identify the selected source from SQL structure. Expanded outputs now report `sourceAlias`, `sourceName`, and `sourceColumnName`, while unavailable metadata is represented as `null`.
