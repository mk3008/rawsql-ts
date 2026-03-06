---
"@rawsql-ts/ztd-cli": patch
"@rawsql-ts/shared-binder": patch
"@rawsql-ts/test-evidence-core": patch
"@rawsql-ts/test-evidence-renderer-md": patch
---

Clarify published vs local-source dogfooding, ensure fresh `ztd init` installs scaffold dependencies, inline scaffold timestamp coercions so generated smoke tests run against the published sql-contract package, make `serial8` DDL mapping generate stable numeric types, align release verification with `pnpm pack/publish` so workspace dependencies are rewritten consistently, and add a repository-root published-package smoke check that packs internal tarballs and reuses them via local overrides before release. Publish `@rawsql-ts/shared-binder`, `@rawsql-ts/test-evidence-core`, and `@rawsql-ts/test-evidence-renderer-md` so released packages can resolve their runtime evidence and binder dependencies.
