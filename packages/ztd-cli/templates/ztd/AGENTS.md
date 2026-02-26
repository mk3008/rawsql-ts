# Package Scope
- Applies to `packages/ztd-cli/templates/ztd`.
- Governs ZTD inputs and related metadata used for generation.

# Policy
## REQUIRED
- `ztd/ddl` MUST remain the human-owned source of truth inside `ztd`.

## ALLOWED
- Tests MAY reference ZTD DDL and generated outputs through ZTD tooling.

## PROHIBITED
- Creating new `ztd` subdirectories without explicit instruction.
- Modifying `ztd/README.md` without explicit instruction.

# Mandatory Workflow
- DDL-related rule updates MUST be made in `ztd/ddl/AGENTS.md`.

# Hygiene
- Keep runtime code independent from `ztd` subtree dependencies.

# References
- DDL policy: [./ddl/AGENTS.md](./ddl/AGENTS.md)
