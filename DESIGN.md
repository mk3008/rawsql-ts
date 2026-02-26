# Repository Design Notes

## Role and Boundaries
- Defines repository-level design boundaries relocated from `AGENTS.md`.
- Covers ZTD model, architecture direction, and documentation constraints.

## Non-Goals
- This file does not define enforceable agent workflow rules.
- This file does not replace package-local contracts.

## ZTD Model
- The database engine is treated as planner/type-checker, not a schema host.
- Tests rely on DDL and fixtures as the canonical test world.
- CRUD statements are rewritten to fixture-backed SELECT execution paths.

## Architecture
- Package direction: `core -> testkit-core -> testkit-postgres/testkit-sqlite`.
- Reverse dependency direction is an architectural violation.

## Test Case Modeling
- Test Case Catalog, Scenario, and Unit Test roles define separation of specification and execution concerns.

## Validation Mapping
- Validation recipe selection depends on installed validator stack (`zod` vs `arktype`).

## API Documentation Policy
- Exported API symbols require clear English JSDoc.
- Public API doc coverage is CI-enforced.
