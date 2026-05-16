---
"@rawsql-ts/ddl-docs-cli": minor
---

Add package scope rule validation and deterministic review-plan generation.

`ddl-docs check` can now validate package-level scope rules and DDL relationship references to those rules, while `ddl-docs review-plan` emits review input JSON from changed files so AI and human reviews can read the relevant scope rules, concepts, DFDs, process maps, and DDL relationship metadata without rediscovering them by inference.
