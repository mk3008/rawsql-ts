# Package Scope
- Applies to `packages/ztd-cli/templates/src/features/smoke/persistence`.

# Policy
## REQUIRED
- Keep one SQL file and one spec per feature-local query unit.
- Keep mapping and contract details beside the SQL file.

## PROHIBITED
- Moving the sample query unit out of the feature unless there is a concrete reuse reason.

