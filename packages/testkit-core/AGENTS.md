# Package Scope
- Applies to `packages/testkit-core`.
- Implements DBMS-agnostic ZTD rewrite logic from CRUD to fixture-backed SELECT.
- Provides fixture/schema resolution and rewrite utilities for driver packages.

# Policy
## REQUIRED
- Rewrites MUST use AST-based parsing/analyzer flow.
- Fixture metadata MUST be authoritative for rewrite output.
- Identifier resolution MUST use normalization helpers.
- Missing fixture/schema/column conditions MUST fail with descriptive errors unless caller mode explicitly allows warn/passthrough.
- Multi-statement SQL rewrite MUST preserve statement order and termination behavior.

## ALLOWED
- Regex fallback MAY be used only when AST support is unavailable.
- Warn/passthrough behavior MAY run only when explicitly configured by caller mode.

## PROHIBITED
- DB-specific branching in core rewrite logic.
- Direct database access or driver wiring in this package.
- Physical table assumptions or physical schema mutation behavior.
- Silent fallback rewriting that changes semantics without diagnostics.

# Mandatory Workflow
- Before committing changes under `packages/testkit-core`, these commands MUST pass:
  - `pnpm --filter @rawsql-ts/testkit-core lint`
  - `pnpm --filter @rawsql-ts/testkit-core test`
  - `pnpm --filter @rawsql-ts/testkit-core build`

# Hygiene
- Rewrite fallback diagnostics MUST be emitted through guarded logger calls.
- Temporary debug traces MUST be removed before commit.

# References
- Rationale: [DESIGN.md](./DESIGN.md)
- Operational notes: [DEV_NOTES.md](./DEV_NOTES.md)
