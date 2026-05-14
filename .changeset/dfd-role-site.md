---
"@rawsql-ts/ddl-docs-cli": patch
---

Add DFD pages and role index generation to the concept-site output, with roles extracted from Mermaid `Who:` nodes instead of duplicated scope tables.

The generated VitePress preview now supports Mermaid rendering for concept/process/DFD source pages and can include DFD and role navigation when DFD relationship metadata is provided.
