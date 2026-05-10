---
"@rawsql-ts/ddl-docs-cli": minor
---

Add DDL review metadata support for table documentation workflows.

The CLI now includes a `check` command that validates table docs metadata, DDL relationship metadata, DDL order metadata, and concept relationship references against discovered DDL objects. Generated table docs can also render review-only design intent, related concepts, related processes, and generated Concept/Process source pages when relationship metadata is provided.
