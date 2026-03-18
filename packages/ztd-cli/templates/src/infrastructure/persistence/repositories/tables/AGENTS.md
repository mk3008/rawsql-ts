# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/persistence/repositories/tables`.
- Defines the lower-level table example for WebAPI persistence query units.

# Policy
## REQUIRED
- This subtree MUST stay aligned with the parent query-unit rule: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.
- CREATE SQL MUST use identifier-focused `RETURNING` when generated keys are required.
- CREATE repository methods MUST return identifier-only results by default.
- UPDATE and DELETE MUST rely on affected-row counts where available.
- `rowCount === 0` conditions MUST surface explicitly according to contract behavior.
- Patch contracts MUST distinguish omitted fields from explicit null values.
- Public repository methods MUST be test-covered for mapping and CUD error behavior.

## PROHIBITED
- UPDATE/DELETE `RETURNING`-based success emulation.
- Follow-up SELECT workarounds for CUD verification.
- Ambiguous patch patterns that hide omitted-vs-null intent.

# Mandatory Workflow
- Table repository changes MUST run tests for affected-row handling and explicit failure surfaces.
