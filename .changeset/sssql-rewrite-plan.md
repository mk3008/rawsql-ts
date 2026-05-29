---
"rawsql-ts": minor
---

Add SSSQL rewrite plan APIs on `SSSQLFilterBuilder` so callers can inspect scaffold, refresh, and remove rewrites before applying them. Plans include rewritten SQL, edit spans, safety metadata, warnings, and errors. Scalar add and remove plans can now return minimal span-based edits when the change can be proven target-local, while unsupported cases fall back to conservative full-reformat warnings.
