# Package Scope
- Applies to `packages/ztd-cli/templates/src/repositories`.
- Defines runtime repository responsibilities for SQL execution orchestration.

# Policy
## REQUIRED
- Repositories MUST load SQL assets from `src/sql` through shared loader infrastructure.
- Repositories MUST use catalog runtime helpers (`ensure*`, `map*`) for input/output validation.
- Repository CUD behavior MUST follow contract rules for `RETURNING`, rowCount handling, and explicit unsupported-driver failures.
- Repository modules MUST reference SQL by stable logical keys.
- Public repository methods MUST be covered by tests.

## ALLOWED
- SELECT methods MAY return `T | null` or `T[]` according to contract cardinality.

## PROHIBITED
- Embedding business rules or contract inference in repositories.
- Inline SQL strings or ad-hoc SQL file path resolution.
- Follow-up SELECT workarounds to emulate CUD success semantics.

# Mandatory Workflow
- Repository changes MUST run tests covering mapping, rowCount behavior, and error surfaces.

# Hygiene
- Error messages MUST include operation identifiers and relevant parameters.

# References
- Tables repository policy: [./tables/AGENTS.md](./tables/AGENTS.md)
- Views repository policy: [./views/AGENTS.md](./views/AGENTS.md)
