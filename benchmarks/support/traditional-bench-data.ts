import { customerSummarySql } from '../ztd-bench/sql/customer_summary';
import { productRankingSql } from '../ztd-bench/sql/product_ranking';
import { salesSummarySql } from '../ztd-bench/sql/sales_summary';

export type TraditionalCase = {
  name: string;
  sql: string;
};

export const TRADITIONAL_CASES: TraditionalCase[] = [
  { name: 'customer-summary', sql: customerSummarySql },
  { name: 'product-ranking', sql: productRankingSql },
  { name: 'sales-summary', sql: salesSummarySql },
];

export const CUSTOMER_ROWS = [
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

export const PRODUCT_ROWS = [
  { product_id: 10, product_name: 'Widget', list_price: '25.00', product_category_id: 1 },
  { product_id: 11, product_name: 'Gadget', list_price: '75.00', product_category_id: 2 },
  { product_id: 12, product_name: 'Accessory', list_price: '5.00', product_category_id: null },
];

export const SALES_ORDER_ROWS = [
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

export const SALES_ORDER_ITEM_ROWS = [
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
