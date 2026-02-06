# tests AGENTS

This directory contains verification code.

## Runtime classification

- This is a non-runtime directory.
- Code here is never part of application runtime.

## Core principles

- This project uses ZTD (Zero Table Dependency).
- DDL and fixtures define the test world.
- Tests must be deterministic and parallel-safe.

## What to test (important)

- Catalog specs are first-class test targets.
- Tests should verify:
  - SQL executes under ZTD rewriting
  - mapping behavior
  - validation success and failure
  - DTO shape and semantics

- Tests MUST NOT enforce repository behavior that contradicts repository contracts.
- Tests MUST NOT require follow-up SELECTs after UPDATE or DELETE by default.

## CUD test policy (important)

- UPDATE and DELETE success/failure MUST be verified via affected-row information
  (e.g. rowCount or equivalent).
- Tests MUST NOT assume UPDATE/DELETE return DTOs.
- If the driver cannot report affected rows, CUD verification is unsupported and
  tests MUST fail fast.
- CREATE tests for table repositories MUST expect identifier-only returns by default.
- Tests MUST NOT require repository follow-up SELECT after CREATE unless the catalog spec explicitly requires DTO return.

## Generated artifacts

- "tests/generated/" is auto-generated.
- Do not edit generated files by hand.
- Regenerate before debugging type errors.

## Boundaries

- Tests may import from "src/".
- Runtime code under "src/" MUST NOT import from "tests/" or "tests/generated/".

## Test runner requirements (required)

- A test runner configuration (e.g. vitest.config.ts) MUST exist.
- Tests MUST be executable with a single command (e.g. `pnpm test`).
- Missing test runner configuration is considered a setup error.

Do not add tests that assume manual setup steps.

## Initialization invariant

- The initial project state MUST include:
  - test runner configuration
  - at least one executable test file
- The initial test run MUST pass or fail only due to user-written logic, not setup.
