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
- "src/catalog/entries": QuerySpec definitions (`specId`, `sqlFile`, params/output contracts, mapping hooks)
- "src/catalog/executor.ts": shared `createCatalogExecutor` wiring
- "src/catalog/runtime": normalization helpers and mapping utilities used by catalog entries

Catalog entries are the asset unit for ZTD and docs.

## Non-negotiable ownership

- Specs are contracts. Do not infer, guess, widen, or narrow them.
- Do not change params / DTO shapes in "specs" without explicit instruction.
- Every catalog query contract MUST carry a stable `query_id`.

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
- tracing emits events with `query_id`
