---
'@rawsql-ts/ztd-cli': patch
---

Safe cleanup for traditional clients

- Traditional execution mode now always closes the Postgres client even when cleanup statements throw, so we avoid leaking connections after tests finish.
- Any cleanup or client close error is recorded and rethrown after profiling finishes so users still observe the true failure.
