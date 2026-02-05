# AGENTS: src/repositories/

## Role
Define repository interfaces that execute SQL files.

## Primary Artifacts
- src/repositories/views/
- src/repositories/tables/

## Do
- Load SQL from src/sql and map parameters/results.
- Keep repositories thin and deterministic.

## Do Not
- Embed raw SQL strings directly in repositories.
- Add test code or fixtures here.

## Workflow
- Add SQL in src/sql.
- Update repositories to use the new SQL.
- Run tests.