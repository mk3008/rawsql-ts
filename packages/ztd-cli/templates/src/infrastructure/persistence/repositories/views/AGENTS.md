# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/persistence/repositories/views`.
- Defines the lower-level view example for WebAPI persistence query units.

# Policy
## REQUIRED
- This subtree MUST stay aligned with the parent query-unit rule: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.
- Queries in this subtree MUST remain read-only.
- Read-model DTO validation MUST run at repository/catalog boundaries.
- Query naming MUST make cardinality assumptions explicit.

## PROHIBITED
- INSERT/UPDATE/DELETE behavior in this subtree.
- Hidden write side effects in read-model query paths.

# Mandatory Workflow
- View repository changes MUST run tests for DTO validation and result ordering assumptions.
