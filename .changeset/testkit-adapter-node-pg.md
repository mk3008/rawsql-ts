---
"@rawsql-ts/adapter-node-pg": patch
---

Clarify that `@rawsql-ts/adapter-node-pg` is the compatible legacy package name for the node-postgres testkit adapter, not the production driver adapter package space. The docs now separate production `driver-adapter-*` packages from future `testkit-adapter-*` packages and describe the non-breaking rename path toward an alias such as `@rawsql-ts/testkit-adapter-node-postgres`.
