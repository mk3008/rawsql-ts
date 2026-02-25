# Package Scope
- Applies to `packages/ztd-cli/templates/src/catalog`.
- Defines runtime catalog contract boundaries between human-owned specs and runtime wiring.

# Policy
## REQUIRED
- Catalog entrypoints MUST bind SQL assets, parameter contracts, output contracts, and runtime validation/mapping.
- `src/catalog/specs` MUST be treated as human-owned contracts.
- `src/catalog/runtime` MUST implement runtime wiring only.
- Code in `src/catalog` MUST remain independent from `tests`, `tests/generated`, and `ztd` imports.
- Each spec MUST be covered by tests for rewrite execution, mapping/validation outcomes, and output shape.

## ALLOWED
- Runtime catalog code MAY add observability hooks where contract behavior is unchanged.

## PROHIBITED
- Changing spec params/DTO contracts without explicit instruction.
- Runtime dependency on ZTD internals.

# Mandatory Workflow
- Catalog spec or runtime changes MUST run tests that exercise affected specs.

# Hygiene
- Preserve clear separation between `specs` and `runtime` responsibilities.

# References
- Specs contract: [./specs/AGENTS.md](./specs/AGENTS.md)
- Runtime contract: [./runtime/AGENTS.md](./runtime/AGENTS.md)
