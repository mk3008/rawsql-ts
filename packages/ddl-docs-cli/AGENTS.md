# Package Scope
- Applies to `packages/ddl-docs-cli`.
- Defines contract rules for the development CLI package.

# Policy
## REQUIRED
- SQL parsing behavior MUST stay AST-first through `rawsql-ts` APIs.
- Regex parsing fallback MUST be guarded and limited to unsupported AST gaps.
- Package dependency footprint MUST remain minimal.

## ALLOWED
- CLI-only development usage MAY depend on package-local tooling.

## PROHIBITED
- Treating this package as runtime application `src/` dependency.

# Mandatory Workflow
- Before committing changes under `packages/ddl-docs-cli`, run:
  - `pnpm --filter @rawsql-ts/ddl-docs-cli lint`
  - `pnpm --filter @rawsql-ts/ddl-docs-cli test`
  - `pnpm --filter @rawsql-ts/ddl-docs-cli build`

# Hygiene
- Temporary debug output MUST be removed before commit.

# References
- Parent policy context: [../../AGENTS.md](../../AGENTS.md)
