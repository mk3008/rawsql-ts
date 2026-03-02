---
title: Execution Scope — Who Manages What
outline: deep
---

# Execution Scope — Who Manages What

rawsql-ts and its companion packages form a layered architecture. Each layer has a clear responsibility boundary. This guide explains what each layer provides and what is left to the caller.

## Responsibility Matrix

| Concern | Owner | Package |
|---------|-------|---------|
| SQL parsing and AST transformation | Library | `rawsql-ts` |
| Result row mapping and validation | Library | `@rawsql-ts/sql-contract` |
| Query catalog and SQL file loading | Library | `@rawsql-ts/sql-contract` |
| Fixture-backed CTE rewriting | Library | `testkit-core`, `testkit-postgres`, `testkit-sqlite` |
| Test connection isolation | Library | `testkit-core` |
| Connection pooling and lifecycle | **Caller** | — |
| Transaction boundaries | **Caller** | — |
| Error recovery and retry policy | **Caller** | — |

## Why transactions are outside library scope

rawsql-ts treats SQL as a **query asset** — something to be parsed, validated, rewritten, and mapped. Transaction commands (`BEGIN` / `COMMIT` / `ROLLBACK`) are **execution control**, not query logic. Mixing the two blurs a boundary that should stay sharp:

- **Query assets** describe *what* data to read or write.
- **Execution control** decides *when* to commit, *how* to recover from failure, and *which* connection to use.

Keeping these concerns separate means:

1. Repositories stay testable with fixture-backed drivers — no transaction plumbing leaks into test setup.
2. The same SQL and mapping code works regardless of the caller's execution strategy (auto-commit, explicit transactions, savepoints, distributed transactions, etc.).
3. Library packages remain driver-agnostic and zero-dependency.

## QueryExecutor and connection scoping

The `QueryExecutor` type used throughout the library has a minimal contract:

```ts
type QueryExecutor = (sql: string, params: readonly unknown[]) => Promise<Row[]>;
```

This type does **not** carry connection identity. If the underlying executor dispatches each call through a connection pool, consecutive queries may land on different connections — making multi-statement transactions unsafe.

For transactional workflows, the caller should scope the executor to a single connection:

```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');

  const executor = async (sql: string, params: readonly unknown[]) => {
    const result = await client.query(sql, params as unknown[]);
    return result.rows;
  };

  // All queries share the same connection and transaction
  const reader = createReader(executor);
  const user = await reader.one('SELECT ...', [userId]);
  await writer.execute('UPDATE ...', [userId, newName]);

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

## Testkit transaction isolation is for testing only

`testkit-core` provides `createTestkitProvider`, which wraps each test scenario in `BEGIN` / `ROLLBACK` for zero-cost isolation. This is a **testing convenience** — it keeps fixtures from leaking between scenarios.

This mechanism is **not** a model for production transaction management:

- Testkit always rolls back; production code needs to commit.
- Testkit manages one connection per test; production code manages pools and concurrent requests.
- Testkit transaction scope is per-scenario; production transaction scope depends on business rules.

## Recommended pattern

A practical production pattern separates three concerns:

```
┌─────────────────────────────────────────┐
│  Application / Service layer            │
│  - Acquires connection from pool        │
│  - Controls BEGIN / COMMIT / ROLLBACK   │
│  - Decides isolation level, retry logic │
├─────────────────────────────────────────┤
│  Repository layer                       │
│  - Receives QueryExecutor               │
│  - Uses sql-contract for mapping        │
│  - Has no knowledge of transactions     │
├─────────────────────────────────────────┤
│  Driver / Pool                          │
│  - Manages physical connections         │
│  - Provides pool.connect()              │
└─────────────────────────────────────────┘
```

The repository layer depends only on `QueryExecutor`. The application layer decides when to start and end transactions. rawsql-ts packages operate exclusively within the repository layer.

## Optional helper package

An optional helper package [`@rawsql-ts/executor`](../../packages/executor/README.md) is available to reduce boilerplate for connection lifecycle and transaction scope, while keeping catalog and repository responsibilities unchanged.

It provides thin helpers such as `withConnection` and `withTransaction` while remaining driver-agnostic through connection factory injection. See the [`@rawsql-ts/executor` README](../../packages/executor/README.md) for usage details and the [DESIGN notes](../../DESIGN.md) for the broader architecture direction.
