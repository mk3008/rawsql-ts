# src/catalog/specs AGENTS

This directory defines query and command specifications (contracts).

## Runtime classification

- This is a runtime directory.
- Contents are human-owned contracts, not implementation details.

## Ownership (critical)

- Specs are human-owned.
- Input parameters are part of the domain contract.
- Output DTO shapes are part of the domain contract.
- Cardinality and semantics are part of the domain contract.

AI MUST NOT:
- infer missing parameters
- widen or narrow DTO shapes
- change nullability or optionality
- change CUD return shape implicitly

Changes require explicit human instruction.

## Validator requirement (required)

- A validator library (zod or arktype) is always available.
- Every spec MUST define validators for its public inputs/outputs.
- Validators are part of the contract and are human-owned.

## Driver variability policy (important)

Specs MUST NOT require SQL assets to encode driver-specific workarounds.

- Specs may acknowledge that SQL rows can vary in representation by driver
  (e.g. timestamps as Date or string).
- Normalization for driver-dependent values is implemented in catalog runtime,
  then validated against the spec.

Contracts define the final DTO shape.
Runtime defines normalization steps to reach that shape.

## What does NOT belong here

- No executors
- No database connections
- No ZTD internals
- No SQL camelCase aliasing rules (SQL rules live under src/sql)
