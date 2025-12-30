# ztd-playground

The `ztd-playground` workspace is a focused environment for validating the entire ZTD development loop on a real Postgres connection while keeping physical schema changes off the table. The playground relies on `@rawsql-ts/pg-testkit` to translate CRUD statements into fixture-backed `SELECT` queries, so every step still runs without creating tables, migrations, or persisted data inside the Postgres instance.

## Generated files (important)

`tests/generated/` is auto-generated and must never be committed to git.

After cloning the repository (or in a clean environment), run:

```bash
pnpm --filter rawsql-ts run build
pnpm --filter @rawsql-ts/testkit-core run build
pnpm --filter @rawsql-ts/ztd-cli run build
pnpm --filter ztd-playground exec ztd ztd-config
```

If TypeScript reports missing modules or type errors because `tests/generated/` is missing, run the same command.

## Environment setup

- Run `pnpm install` from the repository root before touching the playground so all workspace dependencies are available.
- Keep a Postgres server reachable via `DATABASE_URL`; spinning up the Docker service (e.g., `docker compose up -d` with the provided Postgres image) ensures the database is ready whenever you rerun the tests.
- If you change any sources under `packages/ztd-cli`, rerun `pnpm -w build` so the latest CLI artifacts feed into the playground utilities and CLI helpers.

## Quick loop

1. Edit the schema files under `ztd/ddl/<schema>.sql` (e.g., `ztd/ddl/ecommerce.sql`).
2. Regenerate the type-safe config: `pnpm --filter ztd-playground exec ztd ztd-config`.
3. Run type checking so the generated helpers stay verified: `pnpm playground:typecheck`.
4. Execute the tests against Postgres: `pnpm playground:test`.

This loop exercises:

DDL -> `tests/generated/ztd-row-map.generated.ts` -> type definitions -> fixtures -> ZTD rewrite -> test results.

## ZTD layout

- `ztd/ddl/` keeps every CREATE/ALTER TABLE statement along with indexes, constraints, and optional seed rows that make the rewrite pipeline deterministic. Each namespace lives in `ztd/ddl/<schema>.sql`.
- `ztd/enums/` captures domain enums and value lists so downstream tooling uses the same symbols as the fixtures.
- `ztd/domain-specs/` hosts executable SELECT-based specs that describe domain behaviors for humans and AI agents.
- `tests/generated/ztd-layout.generated.ts` records this layout so the CLI and your tests all resolve DDL, enum, and domain-spec directories consistently when they regenerate `tests/generated/ztd-row-map.generated.ts`.

## Postgres execution

- Use `tests/support/testkit-client.ts` to create a `@rawsql-ts/pg-testkit` client so fixtures are rewritten into Postgres `SELECT` queries rather than touching the real schema.
- Set `ZTD_EXECUTION_MODE=traditional` or pass `{ mode: 'traditional', traditional: { isolation: 'schema', cleanup: 'drop_schema' } }` to `createTestkitClient()` when you need to exercise real Postgres behavior such as locks or isolation levels. Traditional mode creates an isolated schema, applies the DDL in `ztd/ddl`, runs optional `setupSql`, seeds the fixtures into physical tables, and cleans up via the configured strategy (`drop_schema`, `custom_sql`, or `none` for debugging). Provide `isolation: 'none'` or a `schemaName` if your SQL needs to reference an existing schema directly.
- `DATABASE_URL` must point to a live Postgres database before running tests or the helper will throw a clear error. The connection is shared across the suite, and the helper keeps the same `pg.Client` open without issuing any DDL.
- Because ZTD never creates tables, the same Postgres database can be reused safely even when the tests run in parallel.

## Sample domain

The EC schema under `ztd/ddl/ecommerce.sql` defines four tables: `customer`, `product`, `sales_order`, and `sales_order_item`. All fixtures, queries, and tests draw from these definitions so the model stays deterministic.

## Sample queries

- `src/customer_summary.ts` projects total orders, spend, and last order date per customer.
- `src/sales_summary.ts` aggregates monthly sales by summing `sales_order_item.quantity * sales_order_item.unit_price`.
- `src/product_ranking.ts` ranks products by cumulative revenue while including the full catalog in the result set.

Each query is expressed as a raw SQL string so the rewrite pipeline can be exercised directly.

## Fixtures and tests

- `tests/generated/ztd-row-map.generated.ts` exports the generated ZTD helpers (table names, row shapes, and `tableFixture`). Prefer importing directly from that file so downstream tooling resolves relative paths consistently.
- Tests import `tableFixture`, the row shape types, and `createTestkitClient` from `tests/support/testkit-client.ts`. The helper wires a Postgres client into `@rawsql-ts/pg-testkit`, adds the `ztd/ddl` directory, and shares the connection across fixtures.
- `tests/generated/ztd-layout.generated.ts` documents the ZTD layout so the CLI and your tests all agree on where to find DDL, enum, and domain-spec files.
- TableNameResolver normalizes every DDL and fixture reference to canonical schema-qualified identifiers, so the playground keeps using schema-qualified names (e.g., `public.customer`) end-to-end.

## Scope

- Do not apply migrations or create tables inside Postgres; the playground relies on `@rawsql-ts/pg-testkit` to rewrite CRUD operations into fixture-backed queries.
- Keep this workspace minimal: only include schema files, SQL examples, the generated config, and the ZTD tests.
