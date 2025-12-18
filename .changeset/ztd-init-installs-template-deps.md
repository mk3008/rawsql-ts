---
"@rawsql-ts/ztd-cli": patch
---

Make `ztd init` produce a self-consistent scaffold by installing the devDependencies referenced by the generated templates.

Postgres remains the default, so `@rawsql-ts/pg-testkit` is automatically added when it is not already declared.
