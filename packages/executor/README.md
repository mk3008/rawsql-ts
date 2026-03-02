# @rawsql-ts/executor

Thin connection-lifecycle and transaction-scope manager for rawsql-ts. Zero dependencies.

## Install

```bash
npm install @rawsql-ts/executor
```

## Quick Start

```typescript
import { createConnectionProvider } from '@rawsql-ts/executor';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: '...' });

const provider = createConnectionProvider({
  connectionFactory: () => pool.connect(),
  // PoolClient has release(), so disposeConnection is optional.
});

// Simple query (no transaction)
const users = await provider.withConnection(async (conn) => {
  const result = await conn.query<{ id: number; name: string }>(
    'SELECT * FROM users'
  );
  return result.rows;
});

// Transaction
await provider.withTransaction(async (conn) => {
  await conn.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [100, fromId]);
  await conn.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [100, toId]);
});
```

> Transaction statements are execution control, not catalog assets.
> Keep `BEGIN` / `COMMIT` / `ROLLBACK` out of SQL files and repository/query specs; use `withTransaction(...)` or driver-level APIs instead.

## API

### `createConnectionProvider(options)`

Creates a `ConnectionProvider` with `withConnection` and `withTransaction` methods.

**Options:**

| Property | Required | Description |
|---|---|---|
| `connectionFactory` | Yes | `() => Promise<T>` — acquires a connection |
| `disposeConnection` | Depends | `(conn: T) => void \| Promise<void>` — releases the connection |

### `ConnectionProvider<T>`

| Method | Description |
|---|---|
| `withConnection(fn)` | Acquires a connection, runs `fn`, then disposes the connection. |
| `withTransaction(fn)` | Acquires a connection, runs `BEGIN`, `fn`, `COMMIT`, then disposes. Rolls back on error. |

## Type-Safe Disposal

The `disposeConnection` requirement is enforced at the type level via overloads:

- **`ReleasableConnection`** (has `release()`): `disposeConnection` is **optional**. If omitted, `release()` is called automatically.
- **`ManagedConnection`** (no `release()`): `disposeConnection` is **required**. Omitting it causes a compile-time error, preventing connection leaks.

If you provide `disposeConnection` on a `ReleasableConnection`, your custom disposer takes precedence over the automatic `release()` call.

```typescript
// OK: PoolClient has release() — disposeConnection is optional
const provider = createConnectionProvider({
  connectionFactory: () => pool.connect(),
});

// OK: standalone Client — explicit disposeConnection
const provider = createConnectionProvider({
  connectionFactory: async () => { const c = new Client(); await c.connect(); return c; },
  disposeConnection: (conn) => conn.end(),
});

// COMPILE ERROR: standalone Client has no release() and no disposeConnection
const provider = createConnectionProvider({
  connectionFactory: async () => { const c = new Client(); await c.connect(); return c; },
  // ^ disposeConnection is required here
});
```

## Why `end()` Is Not Called Automatically

`end()` can be a destructive operation depending on the driver (e.g., permanently closing a connection pool). For safety, the default dispose logic only calls `release()` when available. If you need `end()` semantics (e.g., for a standalone `pg.Client`), provide an explicit `disposeConnection` hook:

```typescript
disposeConnection: (conn) => conn.end()
```

## ROLLBACK Failure Handling

`withTransaction` attempts `ROLLBACK` when the callback or `COMMIT` fails. If `ROLLBACK` itself fails, the secondary failure is suppressed and the **original error is always propagated** to the caller. This follows the principle that the root cause should never be masked by cleanup failures.

## Integration with sql-contract

This package does **not** depend on `@rawsql-ts/sql-contract`. Since `ManagedConnection.query` returns driver-specific result types, you need a small adapter function to extract rows for sql-contract's `QueryExecutor`:

```typescript
import { createReader } from '@rawsql-ts/sql-contract';

await provider.withTransaction(async (conn) => {
  const executor = async (sql: string, params: unknown[]) => {
    const result = await conn.query<Record<string, unknown>>(sql, params);
    return result.rows;
  };

  const reader = createReader(executor);
  const user = await reader.one('SELECT ...', [userId]);
});
```

## License

MIT
