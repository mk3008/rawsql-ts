import { describe, expect } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { defineSqlCatalog, runSqlCatalog } from './utils/sqlCatalog';
import { createSqliteCatalogExecutor } from './helpers/sqlCatalogExecutor';

type UserOrderDto = {
  orderId: number;
  userEmail: string;
  orderTotal: number;
};

const baselineExpected: UserOrderDto[] = [
  { orderId: 10, userEmail: 'alice@example.com', orderTotal: 50 },
  { orderId: 13, userEmail: 'carol@example.com', orderTotal: 35 },
];

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

describe('SQL catalog verifiability with fixture-only sqlite test driver execution', () => {
  const sqlCases = defineSqlCatalog<
    { active: number; minTotal: number; limit: number },
    UserOrderDto
  >({
    id: 'sql.active-orders',
    title: 'JOIN/WHERE/LIMIT semantics',
    fixtures: [usersFixture, ordersFixture],
    catalog: {
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
    },
    cases: [
      {
        id: 'baseline',
        title: 'active users with minimum total',
        assert: (result) => {
          expect(result).toEqual(baselineExpected);
        },
      },
      {
        id: 'changed',
        title: 'active=0 returns a different result set',
        arrange: () => ({ active: 0, minTotal: 20, limit: 2 }),
        assert: (result) => {
          expect(result).toEqual([{ orderId: 12, userEmail: 'bob@example.com', orderTotal: 40 }]);
          expect(result).not.toEqual(baselineExpected);
        },
      },
    ],
  });

  runSqlCatalog(sqlCases, { executor: createSqliteCatalogExecutor() });
});
