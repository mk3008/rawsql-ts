# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/db`.
- Defines SQL client seams and driver adapters for WebAPI-oriented scaffolds.

# Policy
## REQUIRED
- Driver adapters MUST fulfill the `SqlClient` contract without leaking driver-specific result objects.
- Connection lifecycle decisions MUST remain explicit.

## PROHIBITED
- Embedding repository business rules in DB adapter code.

# Mandatory Workflow
- DB adapter changes MUST run typecheck and adapter-focused tests.
