---
"rawsql-ts": patch
---

Add `inOneLine` to keep `IN` value lists compact until `oneLineMaxLength` forces expansion. When the width guard is exceeded, the formatter now falls back to a vertical list layout with comma-prefixed continuation rows.
