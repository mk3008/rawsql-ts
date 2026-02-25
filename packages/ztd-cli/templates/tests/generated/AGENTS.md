# Package Scope
- Applies to `packages/ztd-cli/templates/tests/generated`.
- Governs generated test artifacts.

# Policy
## REQUIRED
- Missing or stale generated files MUST be regenerated using project generation commands.

## ALLOWED
- Generated artifacts MAY be regenerated via `npx ztd ztd-config`.

## PROHIBITED
- Manual edits to files in this directory.
- Committing generated artifacts when repository policy does not require them.

# Mandatory Workflow
- Run generation commands before diagnosing generated-module type errors.

# Hygiene
- Keep generated output reproducible from project tooling.

# References
- Parent tests policy: [../AGENTS.md](../AGENTS.md)
