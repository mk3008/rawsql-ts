---
"@rawsql-ts/testkit-sqlite": major
---

Rename the SQLite testkit package from "@rawsql-ts/sqlite-testkit" to "@rawsql-ts/testkit-sqlite" and move it to `packages/testkit-sqlite` to align with the `testkit-<db>` naming rule.

This is an intentional breaking change. Update imports, install commands, and workspace paths to use "@rawsql-ts/testkit-sqlite".
