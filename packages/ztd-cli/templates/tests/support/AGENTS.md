# tests/support AGENTS

This folder contains shared test infrastructure.

## Scope

- global setup and teardown
- test clients and helpers for execution
- environment/bootstrap logic

## Rules

- Keep helpers minimal and explicit.
- Prefer stable interfaces used across tests.
- Do not place business rules here.

## Boundaries

- Support code may import from "src/" as needed.
- Runtime code under "src/" MUST NOT import from this folder.

## Changes

When modifying global setup or shared clients:
- Re-run a representative subset of tests and at least one full run when feasible.
- Watch for parallelism and resource lifecycle issues.
