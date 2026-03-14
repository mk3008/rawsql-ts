# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/persistence/repositories`.
- Defines repository responsibilities for WebAPI-oriented persistence infrastructure.

# Policy
## REQUIRED
- Repositories MUST load SQL assets from `src/sql` through shared loader infrastructure.
- Repositories MUST use catalog runtime helpers (`ensure*`, `map*`) for input/output validation.
- Repository CUD behavior MUST follow contract rules for `RETURNING`, rowCount handling, and explicit unsupported-driver failures.
- Referencing SQL by stable logical keys is required for repository modules.
- Constructors for repositories SHOULD accept an optional telemetry dependency from `src/infrastructure/telemetry/repositoryTelemetry.ts`.
- Tests MUST cover every public repository method.

## PROHIBITED
- Embedding business rules or contract inference in repositories.
- Inline SQL strings or ad-hoc SQL file path resolution.

# Mandatory Workflow
- Repository changes MUST run tests covering mapping, rowCount behavior, and error surfaces.
