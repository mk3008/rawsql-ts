# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/persistence`.
- Defines persistence-layer rules for WebAPI-oriented scaffolds.

# Policy
## REQUIRED
- ZTD-specific workflow rules apply here and in the related `src/sql`, `src/catalog`, and `ztd` assets.
- Persistence adapters MUST keep handwritten SQL, QuerySpecs, and DDL aligned.
- Repository code MUST rely on explicit contracts and generated/runtime helpers instead of hidden driver behavior.

## PROHIBITED
- Leaking persistence rules into domain, application, or presentation layers.

# Mandatory Workflow
- Persistence changes MUST run `ztd ztd-config`, relevant tests, and the persistence-focused verification flow.
