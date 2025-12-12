import { describe, expect, test } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, TestRowMap, tableSchemas } from './generated/ztd-row-map.generated';
import { createTestkitClient } from './support/testkit-client';
import { productRankingSql } from '../src/product_ranking';

function buildCustomers(): TestRowMap['public.customer'][] {
  // Publish a single customer since revenue comes from order items.
  return [
    {
      customer_id: 1,
      customer_name: 'Enterprise',
      customer_email: 'enterprise@example.com',
      registered_at: '2025-12-01T00:00:00Z',
    },
  ];
}

function buildProducts(): TestRowMap['public.product'][] {
  return [
    { product_id: 30, product_name: 'Gadget', list_price: '60.00', product_category_id: 8 },
    { product_id: 31, product_name: 'Widget', list_price: '15.00', product_category_id: 8 },
    { product_id: 32, product_name: 'Accessory', list_price: '5.00', product_category_id: null },
  ];
}

function buildSalesOrders(): TestRowMap['public.sales_order'][] {
  return [
    {
      sales_order_id: 800,
      customer_id: 1,
      sales_order_date: '2025-12-07',
      sales_order_status_code: 2,
    },
    {
      sales_order_id: 801,
      customer_id: 1,
      sales_order_date: '2025-12-08',
      sales_order_status_code: 2,
    },
  ];
}

function buildSalesOrderItems(): TestRowMap['public.sales_order_item'][] {
  return [
    {
      sales_order_item_id: 8001,
      sales_order_id: 800,
      product_id: 30,
      quantity: 2,
      unit_price: '60.00',
    },
    {
      sales_order_item_id: 8002,
      sales_order_id: 801,
      product_id: 31,
      quantity: 3,
      unit_price: '15.00',
    },
  ];
}

function buildFixtures(): TableFixture[] {
  // Cover every table so the ranking query has data to join against.
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

describe('product_ranking query', () => {
  test('returns every product ordered by revenue', async () => {
    const fixtures = buildFixtures();
    const client = await createTestkitClient(fixtures);

    try {
      // Confirm the ranking honors revenue ordering and includes zero-sales products.
      const rows = await client.query<{
        product_id: number;
        product_name: string;
        total_revenue: number;
      }>(productRankingSql);
      expect(rows).toEqual([
        { product_id: 30, product_name: 'Gadget', total_revenue: 120 },
        { product_id: 31, product_name: 'Widget', total_revenue: 45 },
        { product_id: 32, product_name: 'Accessory', total_revenue: 0 },
      ]);
    } finally {
      await client.close();
    }
  });
});
