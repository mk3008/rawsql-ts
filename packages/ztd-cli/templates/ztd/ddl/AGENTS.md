# AGENTS: ztd/ddl

## Role
Store schema DDL files only.

## Primary Artifacts
- ztd/ddl/<schema>.sql

## Do
- Keep one schema per file and match the filename to the schema name.
- Use SQL DDL statements only.

## Do Not
- Add fixtures or test data here.
- Edit generated files in tests/generated.

## Workflow
- Edit DDL here.
- Run `npx ztd ztd-config` to refresh generated test artifacts.