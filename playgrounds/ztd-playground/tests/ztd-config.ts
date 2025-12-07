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
