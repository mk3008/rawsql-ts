# ztd-playground

The `ztd-playground` workspace is a focused environment for validating the entire ZTD development loop on a real Postgres connection while keeping physical schema changes off the table. The playground relies on `@rawsql-ts/pg-testkit` to translate CRUD statements into fixture-backed `SELECT` queries, so every step still runs without creating tables, migrations, or persisted data inside the Postgres instance.

## Quick loop

1. Edit the schema files under `ddl/schemas`.
2. Regenerate the type-safe config: `pnpm playground:gen-config`.
3. Run type checking so the generated helpers stay verified: `pnpm playground:typecheck`.
4. Execute the tests against Postgres: `pnpm playground:test`.

This loop exercises:

DDL ➜ `ztd-config.ts` ➜ type definitions ➜ fixtures ➜ ZTD rewrite ➜ test results.

## Postgres execution

- Use `tests/test-utils.ts` to create a `@rawsql-ts/pg-testkit` client so fixtures are rewritten into Postgres `SELECT` queries rather than touching the real schema.
- `DATABASE_URL` must point to a live Postgres database before running tests or the helper will throw a clear error. The connection is shared across the suite, and the helper keeps the same `pg.Client` open without issuing any DDL.
- Because ZTD never creates tables, the same Postgres database can be reused safely even when the tests run in parallel.

## Sample domain

The EC schema under `ddl/schemas/ecommerce.sql` defines four tables: `users`, `products`, `orders`, and `order_items`. All fixtures, queries, and tests draw from these definitions so the model stays deterministic.

## Sample queries

- `src/user_summary.ts` projects total orders, spend, and last order date per user.
- `src/sales_summary.ts` aggregates monthly sales by summing `order_items.quantity * order_items.unit_price`.
- `src/product_ranking.ts` ranks products by cumulative revenue while including the full catalog in the result set.

Each query is expressed as a raw SQL string so the rewrite pipeline can be exercised directly.

## Fixtures and tests

- `ztd-config.ts` re-exports the generated ZTD helpers (table names, row shapes, and `tableFixture`).
- Tests import `tableFixture`, the row shape types, and `createTestkitClient` from `tests/test-utils.ts`. The helper wires a Postgres client into `@rawsql-ts/pg-testkit`, adds the `ddl/schemas` directory, and shares the connection across fixtures.
- Every test provides fixtures for `public.users`, `public.products`, `public.orders`, and `public.order_items`, keeping the rewrite results deterministic.
- TableNameResolver normalizes every DDL and fixture reference to canonical schema-qualified identifiers, so the playground keeps using schema-qualified names (e.g., `public.users`) end-to-end.

## Scope

- Do not apply migrations or create tables inside Postgres; the playground relies on `@rawsql-ts/pg-testkit` to rewrite CRUD operations into fixture-backed queries.
- Keep this workspace minimal: only include schema files, SQL examples, the generated config, and the ZTD tests.
