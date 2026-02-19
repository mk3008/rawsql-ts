import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { createSqliteSelectTestDriver } from '../src/driver/SqliteSelectTestDriver';

// Test-only minimal contract for this driver test; not the production SQL Catalog type.
interface TestSqlCatalogSpec<TParams extends Record<string, unknown>, TDto extends Record<string, unknown>> {
  id: string;
  params: {
    shape: 'named';
    example: TParams;
  };
  output: {
    mapping: {
      columnMap: Record<keyof TDto, string>;
    };
  };
  sql: string;
}

type UserOrderDto = {
  orderId: number;
  userEmail: string;
  orderTotal: number;
};

const usersFixture: TableFixture = {
  tableName: 'users',
  rows: [
    { id: 1, email: 'alice@example.com', active: 1 },
    { id: 2, email: 'bob@example.com', active: 0 },
    { id: 3, email: 'carol@example.com', active: 1 },
  ],
  schema: {
    columns: {
      id: 'INTEGER',
      email: 'TEXT',
      active: 'INTEGER',
    },
  },
};

const ordersFixture: TableFixture = {
  tableName: 'orders',
  rows: [
    { id: 10, user_id: 1, total: 50 },
    { id: 11, user_id: 1, total: 20 },
    { id: 12, user_id: 2, total: 40 },
    { id: 13, user_id: 3, total: 35 },
  ],
  schema: {
    columns: {
      id: 'INTEGER',
      user_id: 'INTEGER',
      total: 'INTEGER',
    },
  },
};

const activeOrdersCatalog: TestSqlCatalogSpec<{ active: number; minTotal: number; limit: number }, UserOrderDto> = {
  id: 'orders.active-users.list',
  params: {
    shape: 'named',
    example: { active: 1, minTotal: 20, limit: 2 },
  },
  output: {
    mapping: {
      columnMap: {
        orderId: 'order_id',
        userEmail: 'user_email',
        orderTotal: 'order_total',
      },
    },
  },
  sql: `
    SELECT
      o.id AS order_id,
      u.email AS user_email,
      o.total AS order_total
    FROM orders o
    INNER JOIN users u ON u.id = o.user_id
    WHERE u.active = @active
      AND o.total >= @minTotal
    ORDER BY o.total DESC
    LIMIT @limit
  `,
};

const inactiveOrdersCatalog: TestSqlCatalogSpec<{ active: number; minTotal: number; limit: number }, UserOrderDto> = {
  ...activeOrdersCatalog,
  id: 'orders.inactive-users.list',
  sql: `
    SELECT
      o.id AS order_id,
      u.email AS user_email,
      o.total AS order_total
    FROM orders o
    INNER JOIN users u ON u.id = o.user_id
    WHERE u.active = @active
      AND o.total >= @minTotal
    ORDER BY o.total DESC
    LIMIT @limit
  `,
};

async function executeSqlCatalog<TParams extends Record<string, unknown>, TDto extends Record<string, unknown>>(
  catalog: TestSqlCatalogSpec<TParams, TDto>,
  params: TParams,
  fixtures: TableFixture[]
): Promise<TDto[]> {
  const driver = createSqliteSelectTestDriver({
    connectionFactory: () => new Database(':memory:'),
    fixtures,
  });
  try {
    const rows = await driver.query<Record<string, unknown>>(catalog.sql, [params]);
    return rows.map((row) => {
      const dto: Record<string, unknown> = {};
      // Keep DTO materialization deterministic by mapping only declared output columns.
      for (const [dtoKey, columnName] of Object.entries(catalog.output.mapping.columnMap)) {
        dto[dtoKey] = row[columnName];
      }
      return dto as TDto;
    });
  } finally {
    driver.close();
  }
}

describe('SQL catalog verifiability with fixture-only sqlite test driver execution', () => {
  it('verifies JOIN + WHERE + LIMIT semantics against fixtures and maps DTO output', async () => {
    const result = await executeSqlCatalog(activeOrdersCatalog, { active: 1, minTotal: 20, limit: 2 }, [usersFixture, ordersFixture]);

    expect(result).toEqual([
      { orderId: 10, userEmail: 'alice@example.com', orderTotal: 50 },
      { orderId: 13, userEmail: 'carol@example.com', orderTotal: 35 },
    ]);
  });

  it('guards semantics by asserting a controlled WHERE variant returns a different result set', async () => {
    const baseline = await executeSqlCatalog(activeOrdersCatalog, { active: 1, minTotal: 20, limit: 2 }, [usersFixture, ordersFixture]);
    const changed = await executeSqlCatalog(inactiveOrdersCatalog, { active: 0, minTotal: 20, limit: 2 }, [usersFixture, ordersFixture]);

    expect(changed).toEqual([{ orderId: 12, userEmail: 'bob@example.com', orderTotal: 40 }]);
    expect(changed).not.toEqual(baseline);
  });
});
