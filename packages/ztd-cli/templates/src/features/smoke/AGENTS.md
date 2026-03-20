# Package Scope
- Applies to `packages/ztd-cli/templates/src/features/smoke`.
- Defines the removable sample feature used to teach the scaffold layout.

# Policy
## REQUIRED
- `smoke` MUST stay small enough to delete after a real feature is added.
- The sample feature MUST show domain, application, persistence, and test roles without extra abstraction.
- Feature-local SQL and tests MUST stay adjacent to the sample feature.

## PROHIBITED
- Turning the sample into a shared dependency.
- Adding more moving parts than the sample needs to teach the layout.
