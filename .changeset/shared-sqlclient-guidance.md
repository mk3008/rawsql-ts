---
"@rawsql-ts/ztd-cli": patch
---
Add template guidance that recommends reusing a shared SqlClient per worker process and avoiding cross-worker sharing to prevent unnecessary reconnects.
