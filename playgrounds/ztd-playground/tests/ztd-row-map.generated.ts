// ZTD TEST ROW MAP - AUTO GENERATED
// Tests must import TestRowMap from this file and never from src.
// This file is synchronized with DDL using ztd-config.

import type { FixtureRow, TableFixture, TableSchemaDefinition } from '@rawsql-ts/testkit-core';
export interface TestRowMap {
  'public.order_items': PublicOrderItemsTestRow;
  'public.orders': PublicOrdersTestRow;
  'public.products': PublicProductsTestRow;
  'public.users': PublicUsersTestRow;
}

export interface PublicOrderItemsTestRow extends FixtureRow {
  order_items_id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
}

export interface PublicOrdersTestRow extends FixtureRow {
  orders_id: number;
  user_id: number;
  order_date: string;
  status: string;
}

export interface PublicProductsTestRow extends FixtureRow {
  products_id: number;
  name: string;
  price: string;
  category_id: number | null;
}

export interface PublicUsersTestRow extends FixtureRow {
  users_id: number;
  name: string;
  email: string;
  created_at: string;
}

export type TestRow<K extends keyof TestRowMap> = TestRowMap[K];
export type ZtdRowShapes = TestRowMap;
export type ZtdTableName = keyof TestRowMap;

export type ZtdTableSchemas = Record<ZtdTableName, TableSchemaDefinition>;

export const tableSchemas: ZtdTableSchemas = {
  'public.order_items': {
    columns: {
      order_items_id: "bigint",
      order_id: "bigint",
      product_id: "bigint",
      quantity: "int",
      unit_price: "numeric",
    }
  },
  'public.orders': {
    columns: {
      orders_id: "bigint",
      user_id: "bigint",
      order_date: "date",
      status: "text",
    }
  },
  'public.products': {
    columns: {
      products_id: "bigint",
      name: "text",
      price: "numeric",
      category_id: "bigint",
    }
  },
  'public.users': {
    columns: {
      users_id: "bigint",
      name: "text",
      email: "text",
      created_at: "timestamp",
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
