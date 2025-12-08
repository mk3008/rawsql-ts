import { describe, expect, test } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, TestRowMap, tableSchemas } from '../ztd-config';
import { createTestkitClient } from './test-utils';
import { userSummarySql } from '../src/user_summary';

interface UserSummaryRow {
  users_id: number;
  name: string;
  email: string;
  total_orders: number;
  total_amount: number;
  last_order_date: string | null;
}

function buildUsers(): TestRowMap['public.users'][] {
  // Seed three users so the aggregation covers multiple scenarios.
  return [
    { users_id: 1, name: 'Alice', email: 'alice@example.com', created_at: '2025-12-01T08:00:00Z' },
    { users_id: 2, name: 'Bob', email: 'bob@example.com', created_at: '2025-12-02T09:00:00Z' },
    { users_id: 3, name: 'Cara', email: 'cara@example.com', created_at: '2025-12-03T10:00:00Z' }
  ];
}

function buildProducts(): TestRowMap['public.products'][] {
  // Keep the catalog minimal but cover nullable category IDs.
  return [
    { products_id: 10, name: 'Widget', price: '25.00', category_id: 1 },
    { products_id: 11, name: 'Gadget', price: '75.00', category_id: 2 },
    { products_id: 12, name: 'Accessory', price: '5.00', category_id: null }
  ];
}

function buildOrders(): TestRowMap['public.orders'][] {
  // Assign orders to different users and dates used in the summary.
  return [
    { orders_id: 100, user_id: 1, order_date: '2025-12-04', status: 'completed' },
    { orders_id: 101, user_id: 1, order_date: '2025-12-06', status: 'completed' },
    { orders_id: 200, user_id: 2, order_date: '2025-12-05', status: 'processing' }
  ];
}

function buildOrderItems(): TestRowMap['public.order_items'][] {
  // Attach item rows that produce measurable revenue per order.
  return [
    { order_items_id: 1001, order_id: 100, product_id: 10, quantity: 2, unit_price: '25.00' },
    { order_items_id: 1002, order_id: 101, product_id: 11, quantity: 1, unit_price: '75.00' },
    { order_items_id: 1003, order_id: 200, product_id: 12, quantity: 3, unit_price: '5.00' }
  ];
}

function buildFixtures(): TableFixture[] {
  // Provide fixtures for every domain table so rewrites can resolve joins.
  return [
    tableFixture('public.users', buildUsers(), tableSchemas['public.users']),
    tableFixture('public.products', buildProducts(), tableSchemas['public.products']),
    tableFixture('public.orders', buildOrders(), tableSchemas['public.orders']),
    tableFixture('public.order_items', buildOrderItems(), tableSchemas['public.order_items'])
  ];
}

describe('user_summary query', () => {
  test('totals, spend, and last order appear for each user', async () => {
    const fixtures = buildFixtures();
    const client = await createTestkitClient(fixtures);

    try {
      // Query the SQL string and assert the aggregate columns per user.
      const rows = await client.query<UserSummaryRow>(userSummarySql);
      expect(rows).toEqual([
        {
          users_id: 1,
          name: 'Alice',
          email: 'alice@example.com',
          total_orders: 2,
          total_amount: 125,
          last_order_date: '2025-12-06'
        },
        {
          users_id: 2,
          name: 'Bob',
          email: 'bob@example.com',
          total_orders: 1,
          total_amount: 15,
          last_order_date: '2025-12-05'
        },
        {
          users_id: 3,
          name: 'Cara',
          email: 'cara@example.com',
          total_orders: 0,
          total_amount: 0,
          last_order_date: null
        }
      ]);
    } finally {
      await client.close();
    }
  });
});
