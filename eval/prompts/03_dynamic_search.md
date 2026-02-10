You are working in a generated ZTD playground.

Implement a dynamic-search scenario with safe SQL composition policy.

Requirements:
- Add search SQL assets under `src/sql` using named params only.
- Prefer a DynamicQueryBuilder-style approach in TypeScript for optional filters.
- Do not build SQL via string concatenation or template interpolation with SQL text.
- Keep SQL assets executable in a standard SQL client.
- Keep repository layer free of inline SQL; use catalog/runtime execution path.
- Emit trace events with stable `query_id`.

Deliverables:
- SQL files for search and count queries in `src/sql/**`
- Catalog/runtime integration in `src/catalog/**`
- Repository glue and tests in allowed scope

Verification target:
- `pnpm typecheck`
- `pnpm test`
