# Package Scope
- Applies to `packages/ztd-cli/templates/src/repositories/views`.
- Defines read-model repository behavior for complex SELECT-only queries.

# Policy
## REQUIRED
- Queries in this subtree MUST remain read-only.
- Read-model DTO validation MUST run at repository/catalog boundaries.
- Query naming MUST make cardinality assumptions explicit.

## ALLOWED
- Multi-table joins, aggregations, and purpose-built read DTOs MAY be used.

## PROHIBITED
- INSERT/UPDATE/DELETE behavior in this subtree.
- Hidden write side effects in read-model query paths.

# Mandatory Workflow
- View repository changes MUST run tests for DTO validation and result ordering assumptions.

# Hygiene
- Preserve explicit ordering whenever test behavior depends on row order.

# References
- Parent repository policy: [../AGENTS.md](../AGENTS.md)
