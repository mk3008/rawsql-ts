// ZTD TEST ROW MAP - AUTO GENERATED
// Tests must import TestRowMap from this file and never from src.
// This file is synchronized with DDL using ztd-config.

import type { TableFixture, TableSchemaDefinition } from '@rawsql-ts/testkit-core';
export interface TestRowMap {
  'order_items': OrderItemsTestRow;
  'orders': OrdersTestRow;
  'products': ProductsTestRow;
  'users': UsersTestRow;
}

export interface OrderItemsTestRow {
  order_items_id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
}

export interface OrdersTestRow {
  orders_id: number;
  user_id: number;
  order_date: string;
  status: string;
}

export interface ProductsTestRow {
  products_id: number;
  name: string;
  price: string;
  category_id: number | null;
}

export interface UsersTestRow {
  users_id: number;
  name: string;
  email: string;
  created_at: string;
}

export type TestRow<K extends keyof TestRowMap> = TestRowMap[K];
export type ZtdRowShapes = TestRowMap;
export type ZtdTableName = keyof TestRowMap;

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
