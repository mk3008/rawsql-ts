---
"rawsql-ts": patch
---

Fix SSSQL scalar optional condition refresh so primary-source filters can move safely through roots that contain left joins, sources made nullable by later RIGHT/FULL joins stay in place, and SQL comments are preserved in optimized output.
