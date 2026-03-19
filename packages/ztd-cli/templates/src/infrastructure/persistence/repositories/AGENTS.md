# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/persistence/repositories`.
- Defines repository responsibilities for WebAPI-oriented persistence query units.

# Policy
## REQUIRED
- Persistence repositories MUST keep 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO aligned.
- Repositories MUST load SQL assets from `src/sql` through shared loader infrastructure.
- Repository CUD behavior MUST follow contract rules for `RETURNING`, rowCount handling, and explicit unsupported-driver failures.
- Repositories MUST reference SQL by stable logical keys.
- Constructors for repositories SHOULD accept an optional telemetry dependency from `src/infrastructure/telemetry/repositoryTelemetry.ts`.
- Tests MUST cover every public repository method.

## PROHIBITED
- Inline SQL strings or ad-hoc SQL file path resolution.

# Mandatory Workflow
- Repository changes MUST run tests covering mapping, rowCount behavior, and error surfaces.
