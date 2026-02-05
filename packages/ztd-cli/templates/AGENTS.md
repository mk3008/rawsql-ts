# AGENTS: Repository Root

## Role
Define repository-wide ZTD workflow boundaries and directory responsibilities.

## Primary Artifacts
- ztd/ddl/*.sql (authoritative schema)
- ztd.config.json (layout and schema settings)
- tests/support/* (test wiring)
- tests/generated/* (generated outputs)

## Do
- Treat ztd/ddl as the single source of truth for schema.
- Run `npx ztd ztd-config` after DDL changes.
- When adding, changing, or removing database features, always add ZTD tests that cover the change.
- Keep AGENTS.md files aligned with their folder roles.

## Do Not
- Edit files under tests/generated directly.
- Add demo SQL or demo application code during initialization.

## Workflow
- Update DDL in ztd/ddl.
- Run `npx ztd ztd-config`.
- Implement SqlClient and run tests.
