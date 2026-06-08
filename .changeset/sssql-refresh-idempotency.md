---
"rawsql-ts": patch
---

Keep SSSQL refresh and scaffold planning idempotent when optional branches already use casted null guards.

The SSSQL planner no longer adds a duplicate scalar branch when an equivalent branch already exists with a casted null guard. Refresh planning also keeps existing parameter-named branches in place when the caller does not provide a resolvable physical target name.
