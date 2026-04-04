# ZTD Harness

This folder holds the fixed app-level runner for queryspec ZTD cases.

- `harness.ts` exposes the single runner that query-local cases call.
- `verifier.ts` owns DB-backed setup, execution, assertions, and cleanup.
- `case-types.ts` defines the small v1 case shape.

Query-local AI work should live in `src/features/<feature>/<query>/tests/cases/`.
Generated analysis belongs in `src/features/<feature>/<query>/tests/generated/`.
The Vitest entrypoint `src/features/<feature>/<query>/tests/<query>.queryspec.ztd.test.ts` should stay thin and only adapt the cases to the fixed runner.
`beforeDb` and `afterDb` are pure fixture skeletons with schema-qualified table keys. `afterDb` compares exact rows after normalizing object key order, while row order itself is ignored.
Do not use `--force` to overwrite persistent case files.
