---
"@rawsql-ts/ztd-cli": patch
"@rawsql-ts/shared-binder": patch
---

Clarify published vs local-source dogfooding, ensure fresh `ztd init` installs scaffold dependencies, inline scaffold timestamp coercions so generated smoke tests run against the published sql-contract package, make `serial8` DDL mapping generate stable numeric types, and align release verification with `pnpm pack/publish` so workspace dependencies are rewritten consistently. Publish `@rawsql-ts/shared-binder` so released adapters can resolve their runtime binder dependency.
