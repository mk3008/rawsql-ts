---
'@rawsql-ts/ddl-docs-cli': patch
'@rawsql-ts/ddl-docs-vitepress': patch
---

Fix the published CLI entrypoint metadata so the package points at the generated dist/src/index.js output.

This keeps local pack and publish flows from failing in prepack after a successful build.

