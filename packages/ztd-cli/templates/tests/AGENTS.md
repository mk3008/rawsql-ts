# Package Scope
- Applies to `packages/ztd-cli/templates/tests`.
- Defines verification contract for ZTD template-generated test code.

# Policy
## REQUIRED
- Tests MUST verify SQL execution under ZTD rewrite, mapping behavior, validation paths, and DTO shape semantics.
- CUD tests MUST verify UPDATE/DELETE via affected-row signals.
- CREATE tests for table repositories MUST expect identifier-only returns unless spec explicitly requires DTO return.
- Test runner configuration MUST exist and support single-command execution.
- Initial template state MUST include at least one executable test.

## ALLOWED
- Tests MAY import runtime modules from `src/`.

## PROHIBITED
- Runtime imports from `tests/` or `tests/generated/`.
- Tests that require repository follow-up SELECT behavior contradicting repository contracts.
- Manual edits to generated artifacts.

# Mandatory Workflow
- Test changes MUST run affected test suites and confirm test-runner configuration remains valid.

# Hygiene
- Regenerate `tests/generated` artifacts before diagnosing missing generated module errors.

# References
- Generated tests policy: [./generated/AGENTS.md](./generated/AGENTS.md)
- Shared support policy: [./support/AGENTS.md](./support/AGENTS.md)
