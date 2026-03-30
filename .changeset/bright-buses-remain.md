---
"@rawsql-ts/ztd-cli": minor
---

Expand `ztd feature scaffold` so the CRUD boundary baseline now supports `--action update` and `--action delete` in addition to `insert`. The generated scaffold keeps the same `entryspec.ts` plus query-local `queryspec.ts` and SQL layout, uses `zod` DTO schemas at both boundaries, creates the empty `tests/` directory, and leaves the two test files for an AI follow-up step.
