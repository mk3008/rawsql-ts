---
"rawsql-ts": patch
---

Positional placeholders inside multi-row VALUES clauses are preserved instead of being reclassified as SQL Server MONEY literals so INSERT parsing works with repeated `$n` tokens.
