---
'@rawsql-ts/ddl-docs-cli': patch
'@rawsql-ts/ddl-docs-vitepress': patch
'@rawsql-ts/sql-contract-zod': patch
'@rawsql-ts/sql-grep-core': patch
'@rawsql-ts/test-evidence-renderer-md': patch
'@rawsql-ts/testkit-sqlite': patch
---

Replace workspace-only dependency ranges in published package manifests with publishable semver ranges so standalone consumers can install these packages without workspace resolution errors.
