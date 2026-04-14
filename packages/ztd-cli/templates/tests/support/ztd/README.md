# ZTD Support

This folder holds the starter-owned shared support for queryspec ZTD cases.

- `harness.ts` exposes the fixed app-level runner that query-local cases call.
- `verifier.ts` is a thin adapter that delegates ZTD execution to the testkit library mode API.
- `case-types.ts` defines the small v1 case shape.

Query-local AI work should live in `src/features/<feature>/<query>/tests/cases/`.
Generated analysis belongs in `src/features/<feature>/<query>/tests/generated/`.
The Vitest entrypoint `src/features/<feature>/<query>/tests/<query>.queryspec.ztd.test.ts` should stay thin and only adapt the cases to the fixed runner.
`beforeDb` is a pure fixture skeleton with schema-qualified table keys.
The verifier returns machine-checkable evidence (`mode`, `rewriteApplied`, `physicalSetupUsed`) for each case.
Enable SQL trace only when needed with `ZTD_SQL_TRACE=1` (optional `ZTD_SQL_TRACE_DIR`).
`afterDb` assertions are intentionally excluded from this ZTD lane; use a traditional DB-state test lane when you need post-state assertions.
Do not use `--force` to overwrite persistent case files.
