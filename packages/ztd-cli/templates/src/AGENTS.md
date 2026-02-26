# Package Scope
- Applies to `packages/ztd-cli/templates/src`.
- Governs runtime application code emitted by template generation.

# Policy
## REQUIRED
- Runtime code under `src/` MUST remain independent from `tests/` and `tests/generated/` imports.
- Runtime code MUST remain independent from ZTD internals.
- Runtime modules MUST use explicit contracts and deterministic failure surfaces.

## ALLOWED
- Runtime modules MAY use project typecheck and filtered test commands for validation.

## PROHIBITED
- Importing test-only helpers into runtime code.
- Treating generated artifacts as runtime dependencies.

# Mandatory Workflow
- Before committing changes under `src/`, run project typecheck and relevant tests.

# Hygiene
- Keep runtime modules explicit and small enough to preserve contract boundaries.

# References
- Parent policy: [../AGENTS.md](../AGENTS.md)
