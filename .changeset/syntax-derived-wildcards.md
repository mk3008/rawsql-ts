---
"rawsql-ts": patch
---

Expand CTE and derived-table wildcard SELECT outputs from SQL syntax when the selected source exposes explicit columns. This preserves wildcard output order, keeps duplicate output names as separate SELECT positions, and avoids requiring a table resolver for syntax-derived CTE or subquery columns.
