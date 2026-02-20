import type { TableFixture } from '@rawsql-ts/testkit-core';
import { activeOrdersCatalog } from '../../../src/specs/sql/activeOrders.catalog';
import { defineSqlCatalog } from '../../utils/sqlCatalog';

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

/**
 * SQL catalog spec that verifies active-order selection semantics.
 */
export const activeOrdersSqlCases = defineSqlCatalog({
  id: 'sql.active-orders',
  title: 'Active orders SQL semantics',
  definitionPath: 'src/specs/sql/activeOrders.catalog.ts',
  fixtures: [usersFixture, ordersFixture],
  catalog: activeOrdersCatalog,
  cases: [
    {
      id: 'baseline',
      title: 'active users with minimum total',
      expected: [
        { orderId: 10, userEmail: 'alice@example.com', orderTotal: 50 },
        { orderId: 13, userEmail: 'carol@example.com', orderTotal: 35 },
      ],
    },
    {
      id: 'inactive-variant',
      title: 'inactive users return a different result',
      arrange: () => ({ active: 0, minTotal: 20, limit: 2 }),
      expected: [{ orderId: 12, userEmail: 'bob@example.com', orderTotal: 40 }],
    },
  ],
});
