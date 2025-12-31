import type { TableFixture, TableSchemaDefinition } from '@rawsql-ts/testkit-core';

type PublicCustomerTestRow = {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  registered_at: string;
};

type PublicProductTestRow = {
  product_id: number;
  product_name: string;
  list_price: string;
  product_category_id: number | null;
};

type PublicSalesOrderTestRow = {
  sales_order_id: number;
  customer_id: number;
  sales_order_date: string;
  sales_order_status_code: number;
};

type PublicSalesOrderItemTestRow = {
  sales_order_item_id: number;
  sales_order_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
};

export type TestRowMap = {
  'public.customer': PublicCustomerTestRow;
  'public.product': PublicProductTestRow;
  'public.sales_order': PublicSalesOrderTestRow;
  'public.sales_order_item': PublicSalesOrderItemTestRow;
};

export type ZtdTableName = keyof TestRowMap;

export const tableSchemas: Record<ZtdTableName, TableSchemaDefinition> = {
  'public.customer': {
    columns: {
      customer_id: 'bigint',
      customer_name: 'text',
      customer_email: 'text',
      registered_at: 'timestamp',
    },
  },
  'public.product': {
    columns: {
      product_id: 'bigint',
      product_name: 'text',
      list_price: 'numeric',
      product_category_id: 'bigint',
    },
  },
  'public.sales_order': {
    columns: {
      sales_order_id: 'bigint',
      customer_id: 'bigint',
      sales_order_date: 'date',
      sales_order_status_code: 'int',
    },
  },
  'public.sales_order_item': {
    columns: {
      sales_order_item_id: 'bigint',
      sales_order_id: 'bigint',
      product_id: 'bigint',
      quantity: 'int',
      unit_price: 'numeric',
    },
  },
};

const BASE_CUSTOMERS: PublicCustomerTestRow[] = [
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

const BASE_PRODUCTS: PublicProductTestRow[] = [
  {
    product_id: 10,
    product_name: 'Widget',
    list_price: '25.00',
    product_category_id: 1,
  },
  {
    product_id: 11,
    product_name: 'Gadget',
    list_price: '75.00',
    product_category_id: 2,
  },
  {
    product_id: 12,
    product_name: 'Accessory',
    list_price: '5.00',
    product_category_id: null,
  },
];

const BASE_SALES_ORDERS: PublicSalesOrderTestRow[] = [
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

const BASE_SALES_ORDER_ITEMS: PublicSalesOrderItemTestRow[] = [
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

function cloneRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...(row as Record<string, unknown>) } as T));
}

export function tableFixture<K extends ZtdTableName>(
  tableName: K,
  rows: TestRowMap[K][],
  schema?: TableSchemaDefinition,
): TableFixture {
  return { tableName, rows, schema: schema ?? tableSchemas[tableName] };
}

export function buildCustomerRows(): PublicCustomerTestRow[] {
  return cloneRows(BASE_CUSTOMERS);
}

export function buildProductRows(): PublicProductTestRow[] {
  return cloneRows(BASE_PRODUCTS);
}

export function buildSalesOrderRows(): PublicSalesOrderTestRow[] {
  return cloneRows(BASE_SALES_ORDERS);
}

export function buildSalesOrderItemRows(): PublicSalesOrderItemTestRow[] {
  return cloneRows(BASE_SALES_ORDER_ITEMS);
}

export function buildCustomerSummaryFixtures(schemaName: string): TableFixture[] {
  return [
    tableFixture(
      `${schemaName}.customer` as keyof TestRowMap,
      buildCustomerRows(),
      tableSchemas['public.customer'],
    ),
    tableFixture(
      `${schemaName}.product` as keyof TestRowMap,
      buildProductRows(),
      tableSchemas['public.product'],
    ),
    tableFixture(
      `${schemaName}.sales_order` as keyof TestRowMap,
      buildSalesOrderRows(),
      tableSchemas['public.sales_order'],
    ),
    tableFixture(
      `${schemaName}.sales_order_item` as keyof TestRowMap,
      buildSalesOrderItemRows(),
      tableSchemas['public.sales_order_item'],
    ),
  ];
}

export function buildProductRankingFixtures(schemaName: string): TableFixture[] {
  return [
    // Seed the customer table before sales orders so foreign keys have targets.
    tableFixture(
      `${schemaName}.customer` as keyof TestRowMap,
      buildCustomerRows(),
      tableSchemas['public.customer'],
    ),
    tableFixture(
      `${schemaName}.product` as keyof TestRowMap,
      buildProductRows(),
      tableSchemas['public.product'],
    ),
    tableFixture(
      `${schemaName}.sales_order` as keyof TestRowMap,
      buildSalesOrderRows(),
      tableSchemas['public.sales_order'],
    ),
    tableFixture(
      `${schemaName}.sales_order_item` as keyof TestRowMap,
      buildSalesOrderItemRows(),
      tableSchemas['public.sales_order_item'],
    ),
  ];
}

export function buildSalesSummaryFixtures(schemaName: string): TableFixture[] {
  return [
    // Keep customer rows present so the sales order foreign key can resolve.
    tableFixture(
      `${schemaName}.customer` as keyof TestRowMap,
      buildCustomerRows(),
      tableSchemas['public.customer'],
    ),
    // Product rows are needed by the sales order items that follow.
    tableFixture(
      `${schemaName}.product` as keyof TestRowMap,
      buildProductRows(),
      tableSchemas['public.product'],
    ),
    tableFixture(
      `${schemaName}.sales_order` as keyof TestRowMap,
      buildSalesOrderRows(),
      tableSchemas['public.sales_order'],
    ),
    tableFixture(
      `${schemaName}.sales_order_item` as keyof TestRowMap,
      buildSalesOrderItemRows(),
      tableSchemas['public.sales_order_item'],
    ),
  ];
}
