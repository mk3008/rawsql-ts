# Package Scope
- Applies to `packages/ztd-cli/templates/src/presentation`.
- Defines transport adapters for WebAPI-oriented scaffolds.

# Policy
## REQUIRED
- Presentation code MUST translate external input/output without embedding domain or persistence rules.
- Request/response contracts MUST remain explicit.

## PROHIBITED
- Direct SQL, DDL, or QuerySpec ownership.
- Hidden business rules in controllers or handlers.

# Mandatory Workflow
- Presentation changes MUST run tests for request parsing and response shaping.
