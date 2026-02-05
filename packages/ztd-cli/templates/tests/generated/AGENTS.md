# AGENTS: tests/generated/

## Role
Hold generated ZTD artifacts.

## Primary Artifacts
- tests/generated/ztd-row-map.generated.ts
- tests/generated/ztd-layout.generated.ts

## Do
- Regenerate these files with `npx ztd ztd-config`.

## Do Not
- Edit generated files by hand.

## Workflow
- Run `npx ztd ztd-config` whenever DDL changes.