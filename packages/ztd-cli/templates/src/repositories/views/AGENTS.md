# src/repositories/views AGENTS

This folder is for complex read-only queries.

## Scope

- Complex SELECT queries (joins, aggregations, window functions).
- Read models that are not 1:1 with a single table.

## Allowed

- Multi-table joins and aggregations.
- Purpose-built DTOs for read models.
- Validation at the boundary (catalog validator or repository-level validator).

## Forbidden

- INSERT/UPDATE/DELETE in this folder by default.
- Hidden write side-effects.

## Guidance

- Keep query intent clear in naming.
- Document cardinality assumptions (one, many, optional).
- Prefer stable ordering if tests rely on order.
