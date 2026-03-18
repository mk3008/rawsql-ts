# Package Scope
- Applies to `packages/ztd-cli/templates/src/infrastructure/persistence`.
- Defines persistence-layer rules for WebAPI-oriented scaffolds and their query units.

# Policy
## REQUIRED
- Persistence repositories MUST keep 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO aligned.
- ZTD-specific workflow rules apply here and in the related `src/sql`, `src/catalog`, and `ztd` assets.
- Persistence adapters MUST keep handwritten SQL, QuerySpecs, and DDL aligned.
- Repository code MUST rely on explicit contracts and generated/runtime helpers instead of hidden driver behavior.
- `ZTD_TEST_DATABASE_URL` is the only implicit database owned by `ztd-cli`.
- Non-ZTD database targets MUST be passed explicitly via `--url` or a complete `--db-*` flag set for inspection work.
- Migration SQL artifacts MAY be generated here, but applying them remains outside `ztd-cli` ownership.

## PROHIBITED
- Leaking persistence rules into domain, application, or presentation layers.

# Mandatory Workflow
- Persistence changes MUST run `ztd ztd-config`, relevant tests, and the persistence-focused verification flow.
