---
"rawsql-ts": patch
"@rawsql-ts/testkit-core": patch
"@rawsql-ts/pg-testkit": patch
"@rawsql-ts/sqlite-testkit": patch
"@rawsql-ts/ztd-cli": patch
---

Ensure published packages always include built `dist/` artifacts by building during the `prepack` lifecycle (and in the publish workflow). This fixes cases where `npx ztd init` fails with `MODULE_NOT_FOUND` due to missing compiled entrypoints.
