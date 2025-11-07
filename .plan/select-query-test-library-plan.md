# Select Query Test Library Plan

## Goal & Context
- Deliver a reusable package that lets engineers unit-test SELECT queries by intercepting SQLite execution.
- Keep production connections untouched by injecting deterministic CTE data so table contents can be passed as test inputs.
- Rawsql-ts already exposes physical-table detection; this plan focuses on wrapping SQLite drivers so tests exercise rewritten SQL.

## Role of the Library
- Execute repository/SQL logic tests without touching real tables; focus on correctness, not performance.
- Validate query syntax transformations by running the rewritten SQL end-to-end inside SQLite.
- Allow flexible fixture substitution per test so data scenarios are easy to craft and isolate.
- Run in any environment that can load a SQLite engine; no schema migrations or seeded databases required because tables are synthesized via CTEs.

## Package Responsibilities
- `@rawsql-ts/core`: pure TypeScript utilities for parsing queries, discovering table lineage, and rewriting SQL with fixture-backed CTEs.
- Driver packages (for example `@rawsql-ts/sqlite-testkit`): Node.js or driver-specific layers that wrap concrete database clients, call into core utilities, and manage connection lifecycles plus fixture execution.
- Keeping SQL analysis in core ensures future drivers (Postgres, etc.) reuse identical rewrites, while adapter packages focus solely on I/O concerns such as prepared statements and native bindings.

## Constraints & Assumptions
1. Pure TypeScript implementations cannot cover the required SQLite behavior; native driver bindings remain in play.
2. Infrastructure code already exists for SQLite connections; the new wrapper must accept a connection (or connection factory) via constructor DI to stay decoupled.
3. Tests should never mutate real production tables; the wrapper rewrites queries before they reach the actual driver.
4. The initial scope targets SQLite only, but architecture must allow adding Postgres or other drivers later with minimal churn.
5. Users manage driver versions themselves; the wrapper should depend on stable surface areas (for example Database#prepare or run).

## Architecture Outline
1. TestDriverWrapper: Accepts SQLite connection info, exposes the same API as the underlying driver, and hooks into the query execution method.
2. Rawsql Interceptor: Uses existing rawsql-ts analyzers to enumerate physical tables referenced by incoming SQL.
3. CTE Injector: For each physical table, create a shadow CTE (same name) populated from supplied row fixtures and merge them above the user query.
4. Fixture Registry: Declarative mapping of table name -> rows, passed per test or per suite. Missing tables fall back to real DB access (opt in).
5. Execution Pipeline: wrappedDriver.execute(sql, params) -> parse + rewrite -> forward rewritten SQL to original driver -> return rows.
6. Extensibility Layer: Adapter interface so new drivers implement PreparedStatementAdapter without touching core logic.

## Package Layout Strategy
- Create a new top level package folder (for example packages/drivers/sqlite-testkit).
- Shared abstractions (interfaces, CTE utilities) live in packages/testkit-core to avoid duplicating logic when other drivers arrive.
- Driver-specific packages depend on testkit-core plus the vendor driver; consumers import only the driver package they need.
- Expected folders once SQLite and Postgres adapters exist:
  - `packages/testkit-core` — pure TypeScript contracts, fixture DSL, SQL rewrite helpers (depends only on `@rawsql-ts/core`).
  - `packages/drivers/sqlite-testkit` — wraps SQLite clients (better-sqlite3/sqlite3) and re-exports test harness utilities.
  - `packages/drivers/postgres-testkit` — future adapter that wraps `pg` or `postgres.js`, reusing the same core API.
  - Additional drivers (MySQL, MSSQL, etc.) would follow the same `packages/drivers/<driver>-testkit` naming to keep responsibilities isolated.

## Repository-Centric Usage Example
- Repositories never learn whether they talk to a real driver or the rawsql-ts wrapper; they only depend on a minimal `SelectDriver` interface.
- Tests inject the wrapper configured with fixture tuples `[cteName, rowData[], schemaDefinition]`, guaranteeing predictable inputs without touching production data.
- Schema definitions are required because TypeScript literals do not encode SQLite column affinity; mismatches crash early instead of leaking into runtime failures.

```ts
// Domain code depends on a narrow driver contract.
export interface SelectDriver {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

type UserRow = { id: number; name: string; role: string; created_at: string };

export class UserRepository {
  constructor(private readonly driver: SelectDriver) {}

  async findAdmins(): Promise<UserRow[]> {
    return this.driver.query<UserRow>(
      `SELECT id, name, role, created_at FROM users WHERE role = 'admin'`
    );
  }
}
```

```ts
// Wiring the repository in production or tests only differs in which driver is provided.
import Database from 'better-sqlite3';
import { createSqliteSelectTestDriver } from '@rawsql-ts/sqlite-testkit';

const prodRepo = new UserRepository(
  createSqliteSelectTestDriver({
    connectionFactory: () => new Database('/var/data/app.sqlite'),
    fixtures: [], // none in production; wrapper just proxies to the real DB
    passthroughTables: ['*'],
  })
);

// Test: inject deterministic fixtures and schemas.
const testDriver = createSqliteSelectTestDriver({
  connectionFactory: () => new Database(':memory:'),
  fixtures: [
    {
      cteName: 'users',
      rows: [
        { id: 1, name: 'Alice', role: 'admin', created_at: '2024-01-01' },
        { id: 2, name: 'Bob', role: 'viewer', created_at: '2024-01-02' },
      ],
      schema: {
        id: 'INTEGER',
        name: 'TEXT',
        role: 'TEXT',
        created_at: 'TEXT',
      },
    },
  ],
});

const repo = new UserRepository(testDriver);
await expect(repo.findAdmins()).resolves.toEqual([
  { id: 1, name: 'Alice', role: 'admin', created_at: '2024-01-01' },
]);

// Scenario-specific overrides remain local to a single test.
await testDriver
  .withFixtures([
    {
      cteName: 'users',
      rows: [{ id: 99, name: 'Temp', role: 'admin', created_at: '2024-02-01' }],
      schema: { id: 'INTEGER', name: 'TEXT', role: 'TEXT', created_at: 'TEXT' },
    },
  ])
  .query(`SELECT * FROM users WHERE id = 99`);
```

### Additional Considerations
- Supply helper builders (for example `fixture.table('users').columns({...}).rows([...])`) so schema+data tuples stay ergonomic.
- Enforce schema validation up front; fail fast if a provided literal cannot be coerced to the declared SQL type.
- Provide hooks to inspect or snapshot the rewritten SQL for debugging without polluting production logs.
- Offer a test harness helper (for example `createRepositoryTestContext()`) that instantiates repositories with the wrapped driver to keep specs DRY.
- Centralize schema metadata inside a reusable class so Vitest suites reference a single source of truth instead of repeating column definitions.
- SQL synthesis must honor SQLite affinity rules (e.g., wrap literals with `CAST(... AS TYPE)` or use `json_each`) rather than dumping raw `VALUES` clauses; otherwise text vs numeric comparisons behave differently than production tables.
- Prefer the `SELECT ... FROM (VALUES (...)) AS v(table_columns...)` pattern so multiple rows stay compact without resorting to verbose `UNION ALL` chains and column names stay readable when applying CASTs.
- Keep the connection factory identical between production and tests; the wrapper intercepts table references so you do not need a separate SQLite file just for unit tests.
- Expose a `missingFixtureStrategy` (for example `'error' | 'passthrough' | 'warn'`) so teams can decide whether absent table fixtures should fail fast or fall back to real tables.

## Drop-In Adoption Path
- Many teams already own repositories that accept concrete SQLite drivers (for example `better-sqlite3.Database`) rather than a custom abstraction; the wrapper must mimic that API so the repo code remains untouched.
- The adapter exposes every method the original driver provides (`prepare`, `all`, `get`, `run`, etc.) but intercepts SQL strings before delegating, injecting fixture-backed CTEs on the fly.
- Users swap the constructor argument during tests (or at application bootstrap) without modifying repository logic.
- Schema definitions live in a shared registry; tests only provide row data, keeping per-spec setup minimal.
- A configurable missing-fixture policy determines whether undiscovered tables fall through to the real database or throw immediately, giving each team control over safety vs. convenience.

```ts
// Existing repository that already shipped and cannot change its signature.
import type Database from 'better-sqlite3';

export class OrdersRepository {
  constructor(private readonly db: Database) {}

  findPending(limit: number) {
    return this.db
      .prepare(
        `SELECT o.id, o.total, c.name
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.status = 'pending'
         ORDER BY o.created_at DESC
         LIMIT ?`
      )
      .all(limit);
  }
}

// Wrapper creates a driver lookalike so OrdersRepository does not change.
import Database from 'better-sqlite3';
import { wrapSqliteDriver } from '@rawsql-ts/sqlite-testkit/drop-in';

const rawConnection = new Database(':memory:');
const schema = new AppSchema(); // defined once per system, see Schema Registry section

const interceptedDb = wrapSqliteDriver(rawConnection, {
  schema,
  fixtures: [
    {
      cteName: 'orders',
      rows: [{ id: 1, total: 4200, customer_id: 10, status: 'pending', created_at: '2024-02-03' }],
    },
    {
      cteName: 'customers',
      rows: [{ id: 10, name: 'ACME Inc.' }],
    },
  ],
  missingFixtureStrategy: 'passthrough', // allow real tables when a fixture is omitted
});

const repo = new OrdersRepository(interceptedDb);
expect(repo.findPending(10)).toHaveLength(1);

// Wrapper-generated SQL (conceptual example) showing schema-aware casting via VALUES:
/*
WITH
  orders AS (
    SELECT
      CAST(v.id AS INTEGER) AS id,
      CAST(v.total AS INTEGER) AS total,
      CAST(v.customer_id AS INTEGER) AS customer_id,
      CAST(v.status AS TEXT) AS status,
      CAST(v.created_at AS TEXT) AS created_at
    FROM (VALUES
      (1, 4200, 10, 'pending', '2024-02-03')
      -- additional tuples go here
    ) AS v(id, total, customer_id, status, created_at)
  ),
  customers AS (
    SELECT
      CAST(v.id AS INTEGER) AS id,
      CAST(v.name AS TEXT) AS name
    FROM (VALUES
      (10, 'ACME Inc.')
    ) AS v(id, name)
  )
SELECT o.id, o.total, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'pending'
ORDER BY o.created_at DESC
LIMIT ?
*/
// VALUES tuples stay compact while the surrounding SELECT applies schema-driven casts before exposing columns.
```

- Drop-in mode must be tolerant of driver updates; prefer Proxy-based traps or method shims that forward unknown properties untouched.
- This approach keeps adoption friction low while still allowing greenfield codebases to target the narrower `SelectDriver` contract described earlier.

## Schema Registry Pattern
- Declaring schemas inside every test quickly becomes noisy; instead, define a schema registry class that knows every table and column type once and for all.
- The wrapper accepts either inline schemas (as shown earlier) or a `SchemaRegistry` instance so legacy tests upgrade incrementally.
- Vitest suites can instantiate the registry once per file (or share a singleton) and hand the wrapper only the table definitions it actually touches.

```ts
export interface SqliteTestSchema {
  getTable(name: string): TableDefinition | undefined;
}

export class AppSchema implements SqliteTestSchema {
  private readonly tables: Record<string, TableDefinition> = {
    users: {
      columns: {
        id: 'INTEGER',
        name: 'TEXT',
        role: 'TEXT',
        created_at: 'TEXT',
      },
    },
    permissions: {
      columns: {
        user_id: 'INTEGER',
        scope: 'TEXT',
      },
    },
  };

  getTable(name: string) {
    return this.tables[name];
  }
}
```

```ts
// Vitest setup
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteSelectTestDriver } from '@rawsql-ts/sqlite-testkit';
import { AppSchema } from './AppSchema';

const schema = new AppSchema();
const connectionFactory = () => new Database(process.env.SQLITE_FILE ?? '/var/data/app.sqlite');
let repo: UserRepository;

beforeEach(() => {
  // Same connection settings as production; only the wrapper's interception layer changes behavior.
  const driver = createSqliteSelectTestDriver({
    connectionFactory,
    schema,
    fixtures: [],
    missingFixtureStrategy: 'error',
  });

  repo = new UserRepository(driver);
});

it('returns admins from fixture-backed tables', async () => {
  await repo
    .withFixtures([
      { cteName: 'users', rows: [{ id: 1, name: 'Alice', role: 'admin', created_at: '2024-01-01' }] },
    ])
    .findAdmins();

  expect(await repo.findAdmins()).toHaveLength(1);
});
```

- `SchemaRegistry#getTable` lets the wrapper fetch only the required metadata, keeping the registry extensible for new tables without touching tests.
- Future driver packages can share the same registry contract, ensuring schema knowledge stays centralized even when multiple databases join the stack.

## TODO Tracker
### Phase 0 - Research and Design
- [ ] Document the minimal SQLite driver surface we must wrap (for example better-sqlite3, sqlite3, bun:sqlite).
- [ ] Confirm the rawsql-ts APIs that expose table lineage; capture example outputs for nested queries and CTEs.
- [ ] Decide how fixtures are represented (JSON, builder API, or schema DSL) and how to validate column types.

### Phase 1 - Core Scaffolding
- [ ] Create packages/testkit-core with build, lint, and test wiring, tsconfig, and entrypoint.
- [ ] Define public TypeScript interfaces (TestDriver, QueryInterceptor, FixtureProvider).
- [ ] Set up shared error types (for example MissingFixtureError, UnsupportedStatementError).

### Phase 2 - SQLite Driver Package
- [ ] Scaffold packages/drivers/sqlite-testkit with a dependency on testkit-core.
- [ ] Implement the wrapper class that accepts a SQLite connection or factory, stores it privately, and proxies all lifecycle calls.
- [ ] Ensure DI-friendly constructor signatures so consuming tests can inject in-memory or file-based SQLite connections.

### Phase 3 - SQL Analysis and Rewrite
- [ ] Implement a RawSqlAnalyzer helper that invokes existing rawsql-ts functions to list physical tables, handling nested SELECT, views, and joins.
- [ ] Build the CTE injection utility that:
  - [ ] Generates deterministic CTE aliases (falls back when conflicts exist).
  - [ ] Converts fixture rows into VALUES clauses, including type-safe literal formatting.
  - [ ] Rewrites the original SQL to prepend the generated CTEs.
- [ ] Add safeguards to skip rewrite when statements already reference the same CTE names.

### Phase 4 - Testing Infrastructure
- [ ] Provide a lightweight fixture DSL (for example fixture.table('users').rows([...])).
- [ ] Write unit tests that assert table detection accuracy, rewrite correctness, and execution independence from real tables.
- [ ] Add integration tests that run against an empty SQLite database to prove that fixtures alone satisfy queries.
- [ ] Document guidance for feeding fixtures per test versus per suite.

### Phase 5 - Developer Experience
- [ ] Author README usage examples showing Jest or Vitest setups and how to inject fixtures.
- [ ] Provide migration notes for teams currently hitting shared SQLite instances in CI.
- [ ] Offer escape hatches (for example allowlist tables to pass through untouched) for hybrid tests.

### Phase 6 - Future Driver Extensions
- [ ] Define a driver adapter checklist (required hooks, error translation, feature flags).
- [ ] Spike on Postgres to validate abstractions and capture findings, even if the implementation is deferred.
- [ ] Evaluate packaging approach (one package per driver versus peer dependency injection) based on spike results.

## Risks and Mitigations
- Risk: Fixtures become verbose for wide tables. Mitigation: support CSV or JSON imports and column omission defaults.
- Risk: Engineers might misinterpret the library as a performance harness. Mitigation: explicitly state that its remit is logic/syntax validation plus fixture swapping, not benchmarking; the absence of physical tables is a feature, not a limitation.
- Risk: Driver APIs diverge. Mitigation: keep adapters minimal and favor feature detection over strict type matches.

## Open Questions
1. Fixture validation should run synchronously (eager) so schema mismatches surface before any query executes.
2. Default builds stay silent; tests can pass a debug sink (or import a testing helper) to inspect rewritten SQL while production entry points omit the hook so nothing is logged and debug code can be tree-shaken.
3. Resolved: a centralized schema file provides all type metadata, so automatic introspection is unnecessary.
