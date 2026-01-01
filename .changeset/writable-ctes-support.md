---
'rawsql-ts': patch
---
Support writable CTE parsing
- CTE bodies can now use INSERT, UPDATE, or DELETE statements with RETURNING.
- Column and table collectors now reflect RETURNING outputs for writable CTEs.
