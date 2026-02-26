# Package Scope
- Applies to `packages/ztd-cli/templates/src/catalog/runtime`.
- Defines runtime validation, normalization, and row-to-DTO mapping behavior.

# Policy
## REQUIRED
- Runtime MUST be the only layer that validates unknown input into typed params and validates output contracts.
- Runtime MUST map snake_case SQL rows into DTO objects using explicit normalization rules.
- Timestamp normalization MUST use `timestampFromDriver`.
- Numeric normalization rules MUST be explicit per contract.
- Runtime helpers (`ensure*`, `map*`) MUST validate before returning values.

## ALLOWED
- Command outputs MAY be scalar identifiers or `void` when the contract output is non-DTO.

## PROHIBITED
- Database I/O in runtime mapping modules.
- Importing from `tests/` or `tests/generated/`.
- Defining or editing human-owned contracts in runtime modules.

# Mandatory Workflow
- Runtime changes MUST run tests that cover normalization and validator failure paths.

# Hygiene
- Do not swallow validator errors or silently coerce unsupported values.

# References
- Parent catalog policy: [../AGENTS.md](../AGENTS.md)
