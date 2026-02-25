# SQL Contract Design Notes

## Role and Boundaries
- Defines the package-level design intent for `packages/sql-contract`.
- Keeps a strict boundary between raw SQL contracts and typed mapping/writer helpers.

## Non-Goals
- Becoming an ORM.
- Adding schema-aware query-builder behavior.

## Boundary Intent
- SQL is the specification surface; package APIs adapt rows and emit SQL without schema inference.
- The package is intentionally not an ORM and not a schema-aware query builder.

## Mapper Intent
- Mapping is explicit and caller-controlled.
- Ambiguity is treated as an error condition.

## Writer Intent
- SQL remains visible and explicit.
- WHERE behavior intentionally stays narrow (equality AND lists).
