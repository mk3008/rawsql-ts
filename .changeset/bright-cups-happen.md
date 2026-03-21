---
"@rawsql-ts/adapter-node-pg": patch
"@rawsql-ts/testkit-postgres": patch
---

Fix the published dependency graph for the PostgreSQL adapter tutorial path so standalone consumers can install `@rawsql-ts/adapter-node-pg` without a `workspace:` protocol leak.
