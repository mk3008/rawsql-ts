# AGENTS: src/sql/

## Role
Store SQL statements used by repositories and jobs.

## Primary Artifacts
- src/sql/<table_or_domain>/*.sql

## Do
- Use named parameters (for example `:id`).
- Keep statements focused and readable.

## Do Not
- Embed SQL directly in TypeScript repositories.
- Add DDL here; schema belongs in ztd/ddl.

## Workflow
- Add or update SQL files.
- Update repositories/jobs to call the new SQL.
- Run tests after changes.