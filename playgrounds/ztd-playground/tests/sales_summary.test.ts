import { describe, expect, test } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, TestRowMap, tableSchemas } from './generated/ztd-row-map.generated';
import { createTestkitClient } from './support/testkit-client';
import { salesSummarySql } from '../src/sales_summary';

function buildCustomers(): TestRowMap['public.customer'][] {
  // Two active customers cover multiple months.
  return [
    {
      customer_id: 1,
      customer_name: 'Acme',
      customer_email: 'acme@example.com',
      registered_at: '2025-12-01T00:00:00Z',
    },
    {
      customer_id: 2,
      customer_name: 'Bistro',
      customer_email: 'bistro@example.com',
      registered_at: '2025-12-02T00:00:00Z',
    },
  ];
}

function buildProducts(): TestRowMap['public.product'][] {
  // Products include a nullable category_id to keep DDL coverage broad.
  return [
    { product_id: 20, product_name: 'Bundle', list_price: '40.00', product_category_id: 3 },
    { product_id: 21, product_name: 'Widget Pro', list_price: '5.00', product_category_id: null },
  ];
}

function buildSalesOrders(): TestRowMap['public.sales_order'][] {
  return [
    {
      sales_order_id: 500,
      customer_id: 1,
      sales_order_date: '2025-11-30',
      sales_order_status_code: 2,
    },
    {
      sales_order_id: 501,
      customer_id: 2,
      sales_order_date: '2025-12-02',
      sales_order_status_code: 2,
    },
    {
      sales_order_id: 502,
      customer_id: 1,
      sales_order_date: '2025-12-05',
      sales_order_status_code: 2,
    },
  ];
}

function buildSalesOrderItems(): TestRowMap['public.sales_order_item'][] {
  // Quantities and prices are arranged so November and December produce distinct sums.
  return [
    {
      sales_order_item_id: 5001,
      sales_order_id: 500,
      product_id: 20,
      quantity: 2,
      unit_price: '40.00',
    },
    {
      sales_order_item_id: 5002,
      sales_order_id: 501,
      product_id: 20,
      quantity: 1,
      unit_price: '40.00',
    },
    {
      sales_order_item_id: 5003,
      sales_order_id: 502,
      product_id: 21,
      quantity: 4,
      unit_price: '5.00',
    },
  ];
}

function buildFixtures(): TableFixture[] {
  // Pair every table fixture with its rows so the rewriter can materialize them.
  return [
    tableFixture('public.customer', buildCustomers(), tableSchemas['public.customer']),
    tableFixture('public.product', buildProducts(), tableSchemas['public.product']),
    tableFixture('public.sales_order', buildSalesOrders(), tableSchemas['public.sales_order']),
    tableFixture(
      'public.sales_order_item',
      buildSalesOrderItems(),
      tableSchemas['public.sales_order_item'],
    ),
  ];
}

describe('sales_summary query', () => {
  test('groups revenue by month', async () => {
    const fixtures = buildFixtures();
    const client = await createTestkitClient(fixtures);

    try {
      // Expect one row per month reflecting the summed revenue.
      const rows = await client.query<{ year_month: string; total_revenue: number }>(
        salesSummarySql,
      );
      expect(rows).toEqual([
        { year_month: '2025-11', total_revenue: 80 },
        { year_month: '2025-12', total_revenue: 60 },
      ]);
    } finally {
      await client.close();
    }
  });
});
