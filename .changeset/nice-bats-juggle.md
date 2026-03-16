---
"@rawsql-ts/ztd-cli": patch
"@rawsql-ts/sql-contract-zod": patch
---

Fix npm consumer compatibility for `ztd-cli` by removing the hard `pnpm-workspace.yaml` runtime assumption, requiring `--force` for scaffold overwrites, and emitting Node16/NodeNext-friendly `.js` template imports.

Keep `@rawsql-ts/sql-contract-zod` publishable with a prepack build step while documenting that new projects should prefer `@rawsql-ts/sql-contract` with `zod`.
