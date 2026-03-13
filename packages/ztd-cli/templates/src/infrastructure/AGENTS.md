# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure`.
- Defines infrastructure adapters for WebAPI-oriented scaffolds.

# Policy
## REQUIRED
- Infrastructure code MUST adapt external systems to application or domain-facing contracts.
- Persistence-specific ZTD workflow rules MUST stay in `src/infrastructure/persistence` and related assets.

## PROHIBITED
- Treating infrastructure rules as domain or application rules.

# Mandatory Workflow
- Infrastructure changes MUST run targeted tests for adapter behavior.
