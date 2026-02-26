# Package Scope
- Applies to `packages/sql-contract/tests`.
- Defines contract rules for mapper and writer test behavior.
- Ensures tests validate explicit behavior, not incidental implementation details.

# Policy
## REQUIRED
- Mapper tests MUST verify deterministic row-to-object mapping and explicit relation behavior.
- Most mapper tests MUST use explicit `RowMapping`.
- Complex join tests MUST declare explicit mappings and relations.
- Error-path tests MUST assert failure behavior explicitly.
- Writer tests MUST assert SQL visibility, placeholder ordering, and identifier validation behavior.
- Each test case MUST own its mappings, rows, and assertions.

## ALLOWED
- Duck-typed mapping tests MAY be used only for duck-typing, normalization, or duplicate-detection scenarios.
- Exact error message matching MAY be used when semantically required.

## PROHIBITED
- Testing driver/database connectivity in mapper or writer unit tests.
- Snapshot-testing mapped entities.
- Depending on cross-test entity or mapping state.
- Testing schema inference or ORM-like conveniences.

# Mandatory Workflow
- Before committing changes under `packages/sql-contract/tests`, run:
  - `pnpm --filter @rawsql-ts/sql-contract test`

# Hygiene
- Test fixtures MUST remain explicit and local to each test unless shared helpers are intentional.

# References
- Rationale: [../DESIGN.md](../DESIGN.md)
- Operational notes: [../DEV_NOTES.md](../DEV_NOTES.md)
