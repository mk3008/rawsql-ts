# Customer Repository Demo (Postgres)

This demo mirrors the SQLite sample but showcases `wrapPostgresDriver` and `createPostgresSelectTestDriver`. The goal is to prove you can treat a Postgres `Client` the same as the SQLite adapter while fixtures and rewrites still behave identically.

## Layout
- `.env.demo` - describes the `POSTGRES_URL` environment variable that must point at a running Postgres cluster if you want to connect to a real database.
- `runtime/postgresConfig.ts` - resolves dotenv and exposes helpers for demo-specific connection strings.
- `db/mockConnectionFactory.ts` - creates a live `pg.Client` that points at the Postgres instance described in `.env.demo`.
- `models/Customer.ts` - shared domain model used by the repository and tests.
- `repositories/mappers/customerMapper.ts` - converts raw Postgres rows into `Customer` instances.
- `repositories/CustomerRepository.ts` - thin data layer that uses the Postgres connection abstraction and exposes `listActive`/`findByEmail` helpers plus a `create` helper for demo INSERTs.
- `schema/index.ts` - exposes the schema registry used by the fixtures injected through the interceptor.
- `tests/customer-intercept.test.ts` - proves fixture-backed interception against the docker-backed Postgres instance using `wrapPostgresDriver`.
- `tests/customer-physical.test.ts` - illustrates how the same repository behaves when executing against the real Postgres baseline without interception.
- `tests/customer-legacy-physical-insert.test.ts` - legacy manual insert check that proves the repository can insert rows when hitting the real database.
- `tests/customer-insert.test.ts` - DAL1.0-style insert demo that validates DTO → INSERT … SELECT rewrites via recorded queries.

## Running the Demo
- Spin up a Postgres container that pre-populates the `public.customers` schema:

```bash
cd packages/drivers/postgres-testkit/demo
docker compose -f docker-compose.yml up --build
```

- The service reads `POSTGRES_URL`/`POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` from `.env.demo` so it can mirror the connection string consumed by the repository.

- Both suites connect directly to that Postgres service, so they only run when `POSTGRES_URL` is defined (the tests skip themselves otherwise) and therefore stay out of automated workflows.

 - Physical baseline:

```bash
pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-physical.test.ts
```

 - Fixture interception:

```bash
pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-intercept.test.ts
```

 - Legacy insert demo:

 ```bash
 pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-legacy-physical-insert.test.ts
 ```

- DAL1.0 insert demo:

 ```bash
 pnpm --filter @rawsql-ts/postgres-testkit test demo/tests/customer-insert.test.ts
 ```

The insert demos both connect to the Docker-backed Postgres cluster and exercise the SQL paths
through `CustomerRepository.create`. The legacy version shows how a physical write behaves, while
the DAL1.0 insert demo only inspects the rewritten SQL via `recordQueries` so the assertions stay
within the AST-first guarantees.
The DAL demo keeps the mock connection ignorant of DTOs by returning an empty `SELECT` result;
any `RETURNING` payload is synthesized by the DAL/logout pipeline before it flows back to the repository.

The fixture-backed client still references the same schema names and sanitized CTEs as the rewritten SQL, so these suites let you step through how `wrapPostgresDriver` affects the repository even though the queries execute against a live database.
