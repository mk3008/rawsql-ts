---
"@rawsql-ts/ztd-cli": patch
"@rawsql-ts/sql-grep-core": patch
"@rawsql-ts/test-evidence-renderer-md": patch
---

Fix published package manifests so npm consumers do not receive `workspace:` dependency ranges when installing `@rawsql-ts/ztd-cli` and its internal runtime dependencies.
