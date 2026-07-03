---
"rawsql-ts": patch
---

Fix SSSQL scalar optional condition refresh so primary-source filters can move safely through roots that also contain left joins, while preserving SQL comments in optimized output.
