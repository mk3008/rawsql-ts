# AGENTS: tests/

## Role
Define ZTD tests and test fixtures.

## Primary Artifacts
- tests/**/*.test.ts
- tests/support/*
- tests/generated/* (generated)

## Do
- Use ztd/ddl as the source of truth.
- Regenerate generated artifacts with `npx ztd ztd-config`.

## Do Not
- Edit files under tests/generated directly.
- Bypass repositories with inline SQL in tests.

## Workflow
- Run `npx ztd ztd-config` after DDL changes.
- Run tests with `pnpm test` or `npx vitest run`.