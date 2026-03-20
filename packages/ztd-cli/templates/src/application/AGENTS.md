# Package Scope
- Applies to `packages/ztd-cli/templates/src/application`.
- Defines application-layer orchestration for feature-first scaffolds.

# Policy
## REQUIRED
- Application modules MUST orchestrate domain-facing ports and policies without embedding transport or SQL details.
- Validation and command handling MAY live here when it stays independent from persistence mechanics.

## PROHIBITED
- Direct SQL file access.
- Direct dependence on DDL or QuerySpec implementation details.

# Mandatory Workflow
- Application changes MUST run the relevant typecheck and behavioral tests.
