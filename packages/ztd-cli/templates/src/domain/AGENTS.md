# Package Scope
- Applies to `packages/ztd-cli/templates/src/domain`.
- Defines the domain layer for WebAPI-oriented scaffolds.

# Policy
## REQUIRED
- Domain code MUST remain independent from SQL, DDL, QuerySpecs, and generated test artifacts.
- Domain modules MUST express business rules in transport-agnostic types.

## PROHIBITED
- Importing `src/sql`, `src/catalog`, `ztd`, or telemetry scaffolds into domain code.
- Encoding HTTP or persistence concerns in domain rules.

# Mandatory Workflow
- Domain changes MUST run the relevant typecheck and unit tests.
