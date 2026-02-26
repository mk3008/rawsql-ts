# Package Scope
- Applies to `packages/ztd-cli/templates/src/jobs`.
- Defines contract rules for procedural and batch SQL job code.

# Policy
## REQUIRED
- Jobs MUST declare explicit transaction boundaries.
- Jobs MUST emit start/end operational events or logs.
- Job tests MUST validate observable outcomes.

## ALLOWED
- Jobs MAY execute multiple SQL statements, including temporary-table workflows.
- Heavy jobs MAY split verification across integration and focused fixture tests.

## PROHIBITED
- Coupling job logic to test-only helpers.

# Mandatory Workflow
- Job changes MUST run integration-style tests for affected job paths.

# Hygiene
- Job logic MUST remain idempotent for rerun safety.

# References
- Parent runtime policy: [../AGENTS.md](../AGENTS.md)
