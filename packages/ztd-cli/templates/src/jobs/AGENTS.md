# AGENTS: src/jobs/

## Role
Define job runners that orchestrate repository or SQL execution.

## Primary Artifacts
- src/jobs/*.ts

## Do
- Keep jobs thin and focused on orchestration.
- Delegate SQL execution to repositories.

## Do Not
- Embed DDL or schema definitions here.
- Inline complex SQL strings in jobs.

## Workflow
- Update SQL and repositories first.
- Update job runners to call the new logic.
- Run tests.