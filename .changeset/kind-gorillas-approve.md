---
"@rawsql-ts/ztd-cli": minor
---

Expand `ztd feature scaffold` so the baseline now supports `--action get-by-id` and `--action list` in addition to `insert`, `update`, and `delete`. The generated read scaffolds keep the same feature-local layout, use `queryZeroOrOneRow` for `get-by-id`, and keep default paging plus primary-key ordering inside `list/queryspec.ts` while returning `{ items: [...] }`.

Generated feature/query specs now use shorter private helper names with responsibility-focused JSDoc, reject unsupported request fields by default, and derive bigint-like ID contracts from the DDL instead of assuming 32-bit numeric IDs.
