import { describe, expect, test } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, TestRowMap, tableSchemas } from './ztd-config';
import { createTestkitClient } from './testkit-client';
import { salesSummarySql } from '../src/sales_summary';

function buildSalesUsers(): TestRowMap['public.users'][] {
  // Two active customers cover multiple months.
  return [
    { users_id: 1, name: 'Acme', email: 'acme@example.com', created_at: '2025-12-01T00:00:00Z' },
    { users_id: 2, name: 'Bistro', email: 'bistro@example.com', created_at: '2025-12-02T00:00:00Z' }
  ];
}

function buildSalesProducts(): TestRowMap['public.products'][] {
  // Products include a nullable category_id to keep DDL coverage broad.
  return [
    { products_id: 20, name: 'Bundle', price: '40.00', category_id: 3 },
    { products_id: 21, name: 'Widget Pro', price: '5.00', category_id: null }
  ];
}

function buildSalesOrders(): TestRowMap['public.orders'][] {
  return [
    { orders_id: 500, user_id: 1, order_date: '2025-11-30', status: 'completed' },
    { orders_id: 501, user_id: 2, order_date: '2025-12-02', status: 'completed' },
    { orders_id: 502, user_id: 1, order_date: '2025-12-05', status: 'completed' }
  ];
}

function buildSalesOrderItems(): TestRowMap['public.order_items'][] {
  // Quantities and prices are arranged so November and December produce distinct sums.
  return [
    { order_items_id: 5001, order_id: 500, product_id: 20, quantity: 2, unit_price: '40.00' },
    { order_items_id: 5002, order_id: 501, product_id: 20, quantity: 1, unit_price: '40.00' },
    { order_items_id: 5003, order_id: 502, product_id: 21, quantity: 4, unit_price: '5.00' }
  ];
}

function buildFixtures(): TableFixture[] {
  // Pair every table fixture with its rows so the rewriter can materialize them.
  return [
    tableFixture('public.users', buildSalesUsers(), tableSchemas['public.users']),
    tableFixture('public.products', buildSalesProducts(), tableSchemas['public.products']),
    tableFixture('public.orders', buildSalesOrders(), tableSchemas['public.orders']),
    tableFixture('public.order_items', buildSalesOrderItems(), tableSchemas['public.order_items'])
  ];
}

describe('sales_summary query', () => {
  test('groups revenue by month', async () => {
    const fixtures = buildFixtures();
    const client = await createTestkitClient(fixtures);

    try {
      // Expect one row per month reflecting the summed revenue.
      const rows = await client.query<{ year_month: string; total_revenue: number }>(salesSummarySql);
      expect(rows).toEqual([
        { year_month: '2025-11', total_revenue: 80 },
        { year_month: '2025-12', total_revenue: 60 }
      ]);
    } finally {
      await client.close();
    }
  });
});
