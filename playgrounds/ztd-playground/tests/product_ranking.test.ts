import { describe, expect, test } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, TestRowMap } from '../ztd-config';
import { orderItemSchema, orderSchema, productSchema, userSchema } from './fixture-schema';
import { createTestkitClient } from './test-utils';
import { productRankingSql } from '../src/product_ranking';

function buildRankingUsers(): TestRowMap['users'][] {
  // Publish a single user since revenue comes from order items.
  return [{ users_id: 1, name: 'Enterprise', email: 'enterprise@example.com', created_at: '2025-12-01T00:00:00Z' }];
}

function buildRankingProducts(): TestRowMap['products'][] {
  return [
    { products_id: 30, name: 'Gadget', price: '60.00', category_id: 8 },
    { products_id: 31, name: 'Widget', price: '15.00', category_id: 8 },
    { products_id: 32, name: 'Accessory', price: '5.00', category_id: null }
  ];
}

function buildRankingOrders(): TestRowMap['orders'][] {
  return [
    { orders_id: 800, user_id: 1, order_date: '2025-12-07', status: 'completed' },
    { orders_id: 801, user_id: 1, order_date: '2025-12-08', status: 'completed' }
  ];
}

function buildRankingOrderItems(): TestRowMap['order_items'][] {
  return [
    { order_items_id: 8001, order_id: 800, product_id: 30, quantity: 2, unit_price: '60.00' },
    { order_items_id: 8002, order_id: 801, product_id: 31, quantity: 3, unit_price: '15.00' }
  ];
}

function buildFixtures(): TableFixture[] {
  // Cover every table so the ranking query has data to join against.
  return [
    tableFixture('users', buildRankingUsers(), userSchema),
    tableFixture('products', buildRankingProducts(), productSchema),
    tableFixture('orders', buildRankingOrders(), orderSchema),
    tableFixture('order_items', buildRankingOrderItems(), orderItemSchema)
  ];
}

describe('product_ranking query', () => {
  test('returns every product ordered by revenue', async () => {
    const fixtures = buildFixtures();
    const client = await createTestkitClient(fixtures);

    try {
      // Confirm the ranking honors revenue ordering and includes zero-sales products.
      const rows = await client.query<{ products_id: number; name: string; total_revenue: number }>(productRankingSql);
      expect(rows).toEqual([
        { products_id: 30, name: 'Gadget', total_revenue: 120 },
        { products_id: 31, name: 'Widget', total_revenue: 45 },
        { products_id: 32, name: 'Accessory', total_revenue: 0 }
      ]);
    } finally {
      await client.close();
    }
  });
});
