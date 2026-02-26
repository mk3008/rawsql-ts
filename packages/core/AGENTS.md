# Package Scope
- Provides SQL tokenization, AST construction, query analysis, and formatting for `rawsql-ts`.
- Maintains DBMS-neutral parser/analyzer behavior while representing dialect-specific syntax in AST nodes.
- Exposes AST and formatter APIs consumed by upper layers (`testkit-core`, drivers, CLI tools).
- Owns parser/formatter regression behavior and benchmark baselines for this package.

# Policy
## REQUIRED
- Parser and analyzer changes in `packages/core` MUST remain DBMS-neutral.
- SQL parsing and rewrite implementations in `packages/core` MUST use AST APIs (`SelectQueryParser`, `SelectAnalyzer`, `splitQueries`, formatter APIs).
- Behavior changes and bug fixes in `packages/core` MUST add or update tests.
- Validation commands for `packages/core` (`pnpm --filter rawsql-ts test`, `pnpm --filter rawsql-ts build`, `pnpm --filter rawsql-ts lint`) MUST succeed before commit.
- Added or modified identifiers and code comments MUST be written in English.
- SQL string assertions in tests under `packages/core` MUST compare normalized output from `SqlFormatter`.

## ALLOWED
- AST nodes MAY include vendor syntax fields (for example `DISTINCT ON`, `NOT MATERIALIZED`, `WINDOW`, custom operators) when preserving SQL structure.
- Regex-based rewriting MAY be used only as a fallback when an AST implementation is not viable.
- Each regex fallback MUST include an inline comment that states the AST limitation.
- Each regex fallback MUST include a tracking issue reference.

## PROHIBITED
- Parser and analyzer code in `packages/core` MUST NOT branch by dialect (for example `if postgres`, `if sqlite`, or equivalent flags).
- Code in `packages/core` MUST NOT implement driver-level, DB-level, or testkit-level semantics.
- Code in `packages/core` MUST NOT implement query rewrite responsibilities owned by `testkit-core`.
- Committed files in `packages/core` MUST NOT contain `console.log`, `debugger`, or tracing hooks.
- Committed temporary artifacts MUST NOT be placed outside `./tmp`.

# Mandatory Workflow
- Before committing changes under `packages/core`, the following commands MUST pass:
  - `pnpm --filter rawsql-ts test`
  - `pnpm --filter rawsql-ts build`
  - `pnpm --filter rawsql-ts lint`
- If the commit changes parser or formatter behavior in `packages/core`, the following commands MUST also run:
  - `pnpm --filter rawsql-ts benchmark`
  - `pnpm demo:complex-sql`

# Hygiene
- Local throwaway artifacts MUST be created in `./tmp`.
- Temporary artifacts in `./tmp` MUST be removed before task completion unless converted into tracked tests.

# References
- Dialect and boundary rationale: [DESIGN.md#dialect-agnostic-ast-model](./DESIGN.md#dialect-agnostic-ast-model)
- Testing rationale: [DESIGN.md#testing-philosophy](./DESIGN.md#testing-philosophy)
- Troubleshooting and operational notes: [DEV_NOTES.md](./DEV_NOTES.md)
