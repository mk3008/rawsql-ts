import type { TableFixture } from '@rawsql-ts/testkit-core';

export const userFixture = {
  tableName: 'users',
  rows: [{ id: 1, email: 'alice@example.com' }],
  schema: { columns: { id: 'INTEGER', email: 'TEXT' } },
} satisfies TableFixture;

export const ordersFixture = {
  tableName: 'orders',
  rows: [{ id: 2 }],
  schema: { columns: { id: 'INTEGER' } },
} satisfies TableFixture;
