# AGENTS: ztd/

## Role
Own ZTD schema documentation and the DDL layout under this directory.

## Primary Artifacts
- ztd/ddl/*.sql
- ztd/README.md
- ztd/ddl/AGENTS.md

## Do
- Keep all schema definitions under ztd/ddl.
- Keep this documentation aligned with the actual layout.

## Do Not
- Add runtime application code here.
- Introduce new ztd subdirectories without explicit instruction.

## Workflow
- Edit ztd/ddl/*.sql.
- Run `npx ztd ztd-config` after DDL changes.