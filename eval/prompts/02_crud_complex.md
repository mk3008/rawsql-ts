You are working in a generated ZTD playground.

Implement a CRUD-complex scenario that keeps SQL client-runnable and contract-first.

Requirements:
- Add SQL assets under `src/sql` for a list/read flow with one JOIN and one aggregate.
- Use named SQL parameters only (`:name` style). Do not use positional params.
- Avoid SQL string composition in TypeScript.
- Keep repository methods calling catalog/runtime helpers only (no inline SQL in repositories).
- Ensure catalog runtime emits trace events with `query_id`, `phase`, `duration_ms`, `row_count`, `param_shape`, `error_summary`, `source`.

Deliverables:
- SQL files in `src/sql/**`
- Matching catalog/runtime updates in `src/catalog/**`
- Repository glue updates in `src/repositories/**`
- Tests under `tests/**`

Verification target:
- `pnpm typecheck`
- `pnpm test`
