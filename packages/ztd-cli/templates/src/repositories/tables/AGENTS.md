# AGENTS: src/repositories/tables/

## Role
Implement write-oriented repositories for table CRUD operations.

## Primary Artifacts
- src/repositories/tables/*.ts
- src/sql/**/*.sql

## Do
- Execute INSERT/UPDATE/DELETE SQL from src/sql.
- Keep repository logic thin and predictable.

## Do Not
- Inline SQL strings in TypeScript.
- Add read-only view logic here.

## Workflow
- Update SQL files first.
- Update repositories to match SQL contracts.
- Run tests.