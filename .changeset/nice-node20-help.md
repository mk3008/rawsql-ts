---
"rawsql-ts": patch
---

Avoid eager SQL formatter initialization when loading the package root so Node 20 CLI help paths can import rawsql-ts without triggering a circular initialization error.
