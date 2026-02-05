# AGENTS: tests/support/

## Role
Provide test wiring and shared setup for ZTD tests.

## Primary Artifacts
- tests/support/testkit-client.ts
- tests/support/global-setup.ts

## Do
- Implement the SqlClient wiring here.
- Keep credentials and secrets out of source control.

## Do Not
- Edit files under tests/generated directly.
- Add application code here.

## Workflow
- Configure the SqlClient or adapter.
- Run tests after wiring is complete.