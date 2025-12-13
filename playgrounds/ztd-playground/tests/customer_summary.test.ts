import { describe, expect, test } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, TestRowMap, tableSchemas } from './generated/ztd-row-map.generated';
import { createTestkitClient } from './support/testkit-client';
import { customerSummarySql } from '../src/customer_summary';

interface CustomerSummaryRow {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  total_orders: number;
  total_amount: number;
  last_order_date: string | null;
}

function buildCustomers(): TestRowMap['public.customer'][] {
  // Seed three customers so the aggregation covers multiple scenarios.
  return [
    {
      customer_id: 1,
      customer_name: 'Alice',
      customer_email: 'alice@example.com',
      registered_at: '2025-12-01T08:00:00Z',
    },
    {
      customer_id: 2,
      customer_name: 'Bob',
      customer_email: 'bob@example.com',
      registered_at: '2025-12-02T09:00:00Z',
    },
    {
      customer_id: 3,
      customer_name: 'Cara',
      customer_email: 'cara@example.com',
      registered_at: '2025-12-03T10:00:00Z',
    },
  ];
}

function buildProducts(): TestRowMap['public.product'][] {
  // Keep the catalog minimal but cover nullable category IDs.
  return [
    { product_id: 10, product_name: 'Widget', list_price: '25.00', product_category_id: 1 },
    { product_id: 11, product_name: 'Gadget', list_price: '75.00', product_category_id: 2 },
    { product_id: 12, product_name: 'Accessory', list_price: '5.00', product_category_id: null },
  ];
}

function buildSalesOrders(): TestRowMap['public.sales_order'][] {
  // Assign orders to different customers and dates used in the summary.
  return [
    {
      sales_order_id: 100,
      customer_id: 1,
      sales_order_date: '2025-12-04',
      sales_order_status_code: 2,
    },
    {
      sales_order_id: 101,
      customer_id: 1,
      sales_order_date: '2025-12-06',
      sales_order_status_code: 2,
    },
    {
      sales_order_id: 200,
      customer_id: 2,
      sales_order_date: '2025-12-05',
      sales_order_status_code: 2,
    },
  ];
}

function buildSalesOrderItems(): TestRowMap['public.sales_order_item'][] {
  // Attach item rows that produce measurable revenue per order.
  return [
    {
      sales_order_item_id: 1001,
      sales_order_id: 100,
      product_id: 10,
      quantity: 2,
      unit_price: '25.00',
    },
    {
      sales_order_item_id: 1002,
      sales_order_id: 101,
      product_id: 11,
      quantity: 1,
      unit_price: '75.00',
    },
    {
      sales_order_item_id: 1003,
      sales_order_id: 200,
      product_id: 12,
      quantity: 3,
      unit_price: '5.00',
    },
  ];
}

function buildFixtures(): TableFixture[] {
  // Provide fixtures for every domain table so rewrites can resolve joins.
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

describe('customer_summary query', () => {
  test('totals, spend, and last order appear for each customer', async () => {
    const fixtures = buildFixtures();
    const client = await createTestkitClient(fixtures);

    try {
      // Query the SQL string and assert the aggregate columns per user.
      const rows = await client.query<CustomerSummaryRow>(customerSummarySql);
      expect(rows).toEqual([
        {
          customer_id: 1,
          customer_name: 'Alice',
          customer_email: 'alice@example.com',
          total_orders: 2,
          total_amount: 125,
          last_order_date: '2025-12-06',
        },
        {
          customer_id: 2,
          customer_name: 'Bob',
          customer_email: 'bob@example.com',
          total_orders: 1,
          total_amount: 15,
          last_order_date: '2025-12-05',
        },
        {
          customer_id: 3,
          customer_name: 'Cara',
          customer_email: 'cara@example.com',
          total_orders: 0,
          total_amount: 0,
          last_order_date: null,
        },
      ]);
    } finally {
      await client.close();
    }
  });
});
