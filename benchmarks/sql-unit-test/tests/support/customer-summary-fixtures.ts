import type { TableFixture } from '@rawsql-ts/testkit-core';
import { tableFixture, tableSchemas, TestRowMap } from '../generated/ztd-row-map.generated';
import type { CustomerSummaryRow } from '../../src/CustomerSummaryRow';

function buildCustomers(): TestRowMap['public.customer'][] {
  // Provide a mix of active and inactive customers so the summary aggregates cover all edge cases.
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
  // Keep the catalog small while covering optional category references.
  return [
    { product_id: 10, product_name: 'Widget', list_price: '25.00', product_category_id: 1 },
    { product_id: 11, product_name: 'Gadget', list_price: '75.00', product_category_id: 2 },
    { product_id: 12, product_name: 'Accessory', list_price: '5.00', product_category_id: null },
  ];
}

function buildSalesOrders(): TestRowMap['public.sales_order'][] {
  // Spread orders across customers and time periods for verification.
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
  // Attach items so revenue metrics per order vary in both quantity and unit price.
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

export function buildFixtures(): TableFixture[] {
  // Provide complete fixtures to cover the join chain the repository expects.
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

export const expectedRows: CustomerSummaryRow[] = [
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
];
