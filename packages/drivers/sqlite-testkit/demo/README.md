# Customer Repository Demo

This folder mirrors a realistic repository stack backed by `better-sqlite3` so that SQL interception examples line up with production-style code (domain models, mappers, env-based config, etc.).

## Layout
- `.env.demo` - declares `SQLITE_PATH`, which defaults to `./demo/sqlite/customer-demo.sqlite`.
- `runtime/sqliteConfig.ts` - loads dotenv once and exposes `getDemoSqlitePath()`.
- `db/sqliteConnectionFactory.ts` - resolves `better-sqlite3` instances, mirroring production usage.
- `models/Customer.ts` - domain model shared by services/tests.
- `repositories/mappers/customerMapper.ts` - maps raw rows returned by SQLite into the domain model.
- `repositories/CustomerRepository.ts` - thin data-access layer that exercises prepared statements and converts rows via the mapper.
- `schema/index.ts` - centralized schema registry shared by all intercept-driven tests.
- `tests/customer-physical.test.ts` - exercises the repository against the on-disk database to document baseline behavior.
- `tests/customer-intercept.test.ts` - focuses on fixture-backed interception using `wrapSqliteDriver`.

## Trying The Intercept Test
1. Ensure `better-sqlite3` can be loaded on your platform (Node.js ≥ 20). During `pnpm install` the `postinstall` hook downloads the matching prebuilt binary from the official release feed, so you no longer need a local compiler toolchain for Windows/macOS runners.
2. Run `pnpm --filter @rawsql-ts/sqlite-testkit test demo/tests/customer-physical.test.ts` to see the baseline queries, then `pnpm --filter @rawsql-ts/sqlite-testkit test demo/tests/customer-intercept.test.ts` to see the intercepted behavior. Both suites now depend on the same driver, so you can diff their outputs directly.
3. Inspect the assertions inside the test to see how `wrapSqliteDriver` forces the repository to return synthetic results without touching disk while the baseline repository keeps reading from the physical table.

Even though fixtures can fully shadow the `customers` table, the physical database remains in the repo so you can manually compare baseline results whenever you want to double-check the interception behavior.
