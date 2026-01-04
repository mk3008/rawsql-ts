---
"rawsql-ts": patch
---

This change introduces better typing for keyword comments (legacy vs positioned) across the command, explain, order-by, select, and using parsers so the scheduler can retain comment metadata during DDL/SQL rewrites.
