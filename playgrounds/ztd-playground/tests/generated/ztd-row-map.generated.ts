// ZTD TEST ROW MAP - AUTO GENERATED
// Tests must import TestRowMap from this file and never from src.
// This file is synchronized with DDL using ztd-config.

import type { FixtureRow, TableFixture, TableSchemaDefinition } from '@rawsql-ts/testkit-core';
export interface TestRowMap {
  'public.customer': PublicCustomerTestRow;
  'public.product': PublicProductTestRow;
  'public.sales_order': PublicSalesOrderTestRow;
  'public.sales_order_item': PublicSalesOrderItemTestRow;
}

export interface PublicCustomerTestRow extends FixtureRow {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  registered_at: string;
}

export interface PublicProductTestRow extends FixtureRow {
  product_id: number;
  product_name: string;
  list_price: string;
  product_category_id: number | null;
}

export interface PublicSalesOrderTestRow extends FixtureRow {
  sales_order_id: number;
  customer_id: number;
  sales_order_date: string;
  sales_order_status_code: number;
}

export interface PublicSalesOrderItemTestRow extends FixtureRow {
  sales_order_item_id: number;
  sales_order_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
}

export type TestRow<K extends keyof TestRowMap> = TestRowMap[K];
export type ZtdRowShapes = TestRowMap;
export type ZtdTableName = keyof TestRowMap;

export type ZtdTableSchemas = Record<ZtdTableName, TableSchemaDefinition>;

export const tableSchemas: ZtdTableSchemas = {
  'public.customer': {
    columns: {
      customer_id: "bigint",
      customer_name: "text",
      customer_email: "text",
      registered_at: "timestamp",
    }
  },
  'public.product': {
    columns: {
      product_id: "bigint",
      product_name: "text",
      list_price: "numeric",
      product_category_id: "bigint",
    }
  },
  'public.sales_order': {
    columns: {
      sales_order_id: "bigint",
      customer_id: "bigint",
      sales_order_date: "date",
      sales_order_status_code: "int",
    }
  },
  'public.sales_order_item': {
    columns: {
      sales_order_item_id: "bigint",
      sales_order_id: "bigint",
      product_id: "bigint",
      quantity: "int",
      unit_price: "numeric",
    }
  },
};

export function tableSchema<K extends ZtdTableName>(tableName: K): TableSchemaDefinition {
  return tableSchemas[tableName];
}

export type ZtdTableFixture<K extends ZtdTableName> = TableFixture & {
  tableName: K;
  rows: ZtdRowShapes[K][];
  schema: TableSchemaDefinition;
};

export interface ZtdConfig {
  tables: ZtdTableName[];
}

export function tableFixture<K extends ZtdTableName>(
  tableName: K,
  rows: ZtdRowShapes[K][],
  schema?: TableSchemaDefinition
): TableFixture {
  return { tableName, rows, schema };
}

export function tableFixtureWithSchema<K extends ZtdTableName>(
  tableName: K,
  rows: ZtdRowShapes[K][]
): ZtdTableFixture<K> {
  // Always pair fixture rows with the canonical schema generated from DDL.
  return { tableName, rows, schema: tableSchemas[tableName] };
}
