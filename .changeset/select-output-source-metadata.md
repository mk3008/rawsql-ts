---
"rawsql-ts": patch
---

Include source metadata on `SelectOutputCollector` entries when SQL structure can safely identify the selected source. Wildcard expansion and uniquely matched qualified column references now report `sourceAlias`, `sourceName`, and `sourceColumnName`, while unavailable or unsafe-to-infer metadata is represented as `null`.
