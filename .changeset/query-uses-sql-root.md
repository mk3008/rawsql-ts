---
'@rawsql-ts/ztd-cli': patch
---

Teach `ztd query uses` to resolve existing `spec.sqlFile` values against a project SQL root such as `src/sql` before falling back to legacy spec-relative lookup, and improve unresolved-file guidance.
