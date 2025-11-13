# Customer Repository Demo (Postgres)

This demo mirrors the SQLite sample but showcases `wrapPostgresDriver` and `createPostgresSelectTestDriver`. The goal is to prove you can treat a Postgres `Client` the same as the SQLite adapter while fixtures and rewrites still behave identically.

## Layout
- `.env.demo` - describes the `POSTGRES_URL` environment variable that must point at a running Postgres cluster if you want to connect to a real database.
- `runtime/postgresConfig.ts` - resolves dotenv and exposes helpers for demo-specific connection strings.
- `db/mockConnectionFactory.ts` - builds a lightweight `PostgresConnectionLike` that records SQL and returns row sets based on table names, so we can run the demo without a live database.
- `models/Customer.ts` - shared domain model used by the repository and tests.
- `repositories/mappers/customerMapper.ts` - converts raw Postgres rows into `Customer` instances.
- `repositories/CustomerRepository.ts` - thin data layer that uses the Postgres connection abstraction and exposes `listActive`/`findByEmail` helpers.
- `schema/index.ts` - exposes the schema registry used by the fixtures injected through the interceptor.
- `tests/customer-intercept.test.ts` - proves fixture-backed interception via `wrapPostgresDriver`.
- `tests/customer-physical.test.ts` - illustrates how the same repository behaves when executing against the mock Postgres client without interception.

## Running the Demo
- Spin up a Postgres container that pre-populates the `public.customers` schema:

```bash
cd packages/drivers/postgres-testkit/demo
docker compose -f docker-compose.yml up --build
```

The service reads `POSTGRES_URL`/`POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` from `.env.demo` so it can mirror the connection string consumed by the repository.

- Physical baseline:

```bash
pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-physical.test.ts
```

- Fixture interception:

```bash
pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-intercept.test.ts
```

The mocked client references the same schema names and sanitized CTEs as the rewritten SQL, so you can step through how `wrapPostgresDriver` affects the repository without pointing at a live database.
