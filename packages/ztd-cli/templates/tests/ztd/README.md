# ZTD Harness

This folder holds the fixed app-level runner for ZTD cases.

- `harness.ts` exposes the single runner that feature-local cases call.
- `verifier.ts` owns DB-backed setup, execution, assertions, and cleanup.
- `case-types.ts` defines the small v1 case shape.

Feature-local AI work should live in `src/features/<feature>/tests/ztd/cases/`.
Generated analysis belongs in `src/features/<feature>/tests/ztd/generated/`.
Do not use `--force` to overwrite persistent case files.
