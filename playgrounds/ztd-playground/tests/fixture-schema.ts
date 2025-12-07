import type { TableSchemaDefinition } from '@rawsql-ts/testkit-core';

// TableSchemaDefinition accepts SQLite affinity names, so these values (INTEGER/TEXT/NUMERIC) mirror the Postgres column semantics from the DDL.
// Table schemas describe Postgres column types for the rewrite fixtures.
export const userSchema: TableSchemaDefinition = {
  columns: {
    users_id: 'INTEGER',
    name: 'TEXT',
    email: 'TEXT',
    created_at: 'TEXT'
  }
};

export const productSchema: TableSchemaDefinition = {
  columns: {
    products_id: 'INTEGER',
    name: 'TEXT',
    price: 'NUMERIC',
    category_id: 'INTEGER'
  }
};

export const orderSchema: TableSchemaDefinition = {
  columns: {
    orders_id: 'INTEGER',
    user_id: 'INTEGER',
    order_date: 'TEXT',
    status: 'TEXT'
  }
};

export const orderItemSchema: TableSchemaDefinition = {
  columns: {
    order_items_id: 'INTEGER',
    order_id: 'INTEGER',
    product_id: 'INTEGER',
    quantity: 'INTEGER',
    unit_price: 'NUMERIC'
  }
};
