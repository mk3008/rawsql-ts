---
"rawsql-ts": patch
---

Add `SelectOutputCollector` for SELECT output analysis that preserves duplicate output names and exposes a stable `outputIndex` for each returned output position after supported wildcard expansion.
