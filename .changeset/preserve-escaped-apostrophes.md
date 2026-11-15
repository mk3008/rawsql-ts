---
"rawsql-ts": patch
---

Preserve escaped apostrophes in single-quoted SQL literals across parsing and formatting. AST values now contain the decoded apostrophes.
