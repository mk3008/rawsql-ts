# AGENTS: src/

## Role
Host application-facing SQL, repositories, and job runners.

## Primary Artifacts
- src/sql/
- src/repositories/
- src/jobs/
- src/db/sql-client.ts

## Do
- Keep SQL in files under src/sql.
- Keep repositories thin and focused on executing SQL.

## Do Not
- Add DDL or generated artifacts here.
- Embed demo SQL in TypeScript files.

## Workflow
- Add or update SQL files.
- Update repositories or jobs to call the SQL.
- Run `npx ztd ztd-config` after schema changes, then tests.