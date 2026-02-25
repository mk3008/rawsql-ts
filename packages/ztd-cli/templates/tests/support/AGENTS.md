# Package Scope
- Applies to `packages/ztd-cli/templates/tests/support`.
- Defines shared test infrastructure contracts.

# Policy
## REQUIRED
- Shared support helpers MUST stay minimal and explicit.
- Shared support code MUST avoid business-rule ownership.
- Runtime code under `src/` MUST NOT import from this folder.

## ALLOWED
- Support helpers MAY import from `src/`.

## PROHIBITED
- Embedding domain business logic into support infrastructure.

# Mandatory Workflow
- Global setup/support changes MUST run representative subset tests and at least one full test run.

# Hygiene
- Validate resource lifecycle and parallelism behavior after support-layer changes.

# References
- Parent tests policy: [../AGENTS.md](../AGENTS.md)
