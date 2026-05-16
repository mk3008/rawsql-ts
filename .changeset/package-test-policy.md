---
"@rawsql-ts/ddl-docs-cli": minor
---

Add package verification policy support to ddl-docs metadata checks and review plans.

The `check` command now accepts optional `--test-rules` metadata and validates package-level verification policy structure. The `review-plan` command can include `--test-policy` and `--test-rules` so generated review input identifies mandatory verification policy files and per-artifact test policy reads without treating generated docs as source of truth.
