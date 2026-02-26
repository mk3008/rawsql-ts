# Package Scope
- Applies to `packages/ztd-cli/templates/src/sql`.
- Defines SQL asset contract rules for runtime execution.

# Policy
## REQUIRED
- SQL assets MUST use named parameters (`:name`).
- SQL assets MUST stay DTO-independent and use database-oriented column naming.
- UPDATE and DELETE statements MUST include WHERE clauses.
- SQL files MUST remain explicit enough for repository/runtime mapping contracts.
- CUD `RETURNING` behavior MUST follow repository contract rules.

## ALLOWED
- INSERT SQL MAY use `RETURNING` for identifiers and required DB-generated contract columns.

## PROHIBITED
- Positional placeholders in SQL asset files.
- DTO camelCase aliasing inside SQL assets.
- UPDATE/DELETE `RETURNING` usage.
- SQL-side emulation of affected-row verification behavior.

# Mandatory Workflow
- SQL asset changes MUST run tests that execute the changed SQL via catalog/repository paths.

# Hygiene
- Keep SQL filenames stable and unambiguous for CRUD intent.
- Avoid `select *` unless explicitly justified by contract behavior.

# References
- Parent runtime policy: [../AGENTS.md](../AGENTS.md)
