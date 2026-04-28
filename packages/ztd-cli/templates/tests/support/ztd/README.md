# Query-Boundary Test Support

This folder holds the starter-owned shared support for query-boundary ZTD and traditional cases.

- `harness.ts` exposes the fixed app-level runners that query-local cases call.
- `verifier.ts` adapts ZTD cases to fixture rewriting and traditional cases to physical DDL + fixture setup.
- `case-types.ts` defines the small v1 case shapes.

Query-local AI work should live in `src/features/<feature>/queries/<query>/tests/cases/`.
Generated analysis belongs in `src/features/<feature>/queries/<query>/tests/generated/`.
The Vitest entrypoint `src/features/<feature>/queries/<query>/tests/<query>.boundary.<kind>.test.ts` should stay thin and only adapt the cases to the fixed runner.
`beforeDb` is a pure fixture skeleton with schema-qualified table keys.
The query-boundary ZTD case type carries `beforeDb`, `input`, and `output`.
The traditional case type uses the same core shape and may add `afterDb` for post-state assertions.
The verifier returns machine-checkable evidence (`mode`, `rewriteApplied`, `physicalSetupUsed`) for each case.
Traditional evidence should report `mode=traditional` and `physicalSetupUsed=true`.
Enable SQL trace only when needed with `ZTD_SQL_TRACE=1` (optional `ZTD_SQL_TRACE_DIR`).
Do not use `--force` to overwrite persistent case files.
