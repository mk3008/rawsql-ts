# AGENTS: src/repositories/views/

## Role
Implement read-only repositories that run SELECT queries.

## Primary Artifacts
- src/repositories/views/*.ts
- src/sql/**/*.sql

## Do
- Use SELECT statements only.
- Map SQL results to DTOs deterministically.

## Do Not
- Perform writes or mutations here.
- Inline SQL strings in TypeScript.

## Workflow
- Add or update SQL files.
- Update repository logic to match.
- Run tests.