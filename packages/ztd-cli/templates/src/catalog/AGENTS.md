# src/catalog AGENTS

This directory is runtime code.

## Purpose

Catalog defines named query entry points by binding:
- SQL assets ("src/sql/*.sql")
- input parameter contracts
- output DTO contracts
- validation and mapping behavior
- observability hooks (if supported)

## Directory roles (important)

- "src/catalog/specs": human-owned contracts (params + DTO + semantics)
- "src/catalog/runtime": AI-assisted runtime wiring (executors, helpers, sinks)

## Non-negotiable ownership

- Specs are contracts. Do not infer, guess, widen, or narrow them.
- Do not change params / DTO shapes in "specs" without explicit instruction.

## Boundaries

- Code under "src/catalog/" MUST NOT import from:
  - "tests/"
  - "tests/generated/"
  - "ztd/"
- Do not depend on ZTD internals at runtime.

## Testing rule (required)

Every spec MUST have tests that verify:
- SQL executes under ZTD rewriting
- mapping/validation behavior is correct (success and failure)
- output DTO shape matches expectations
