import { expect, test } from 'vitest';
import { renderZtdConfigFile, snapshotTableMetadata } from '../src/commands/ztdConfig';
import type { SqlSource } from '../src/utils/collectSqlFiles';
import { normalizeLineEndings } from './utils/normalize';

test('generates ZTD row map from CREATE TABLE statements', () => {
  const sources: SqlSource[] = [
    {
      path: 'DDL/users.sql',
      sql: `
        CREATE TABLE public.users (
          id serial PRIMARY KEY,
          email text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE public.profiles (
          user_id bigint NOT NULL,
          bio text,
          rating numeric
        );
      `
    }
  ];

  // Capture the table metadata so the renderer can produce TypeScript declarations.
  const tables = snapshotTableMetadata(sources);
  expect(tables.map((table) => table.name)).toEqual(['public.profiles', 'public.users']);

  // Normalize line endings so snapshots remain stable across platforms.
  const output = normalizeLineEndings(renderZtdConfigFile(tables));

  expect(output).toMatchSnapshot();
});

test('handles multiple sources with composite keys and cross-schema references', () => {
  const sources: SqlSource[] = [
    {
      path: 'DDL/users.sql',
      sql: `
        CREATE TABLE public.users (
          id serial PRIMARY KEY,
          name text NOT NULL
        );
      `
    },
    {
      path: 'DDL/sales/orders.sql',
      sql: `
        CREATE TABLE sales.orders (
          order_id bigint NOT NULL,
          line bigint NOT NULL,
          customer_id bigint NOT NULL,
          total numeric NOT NULL,
          PRIMARY KEY (order_id, line),
          FOREIGN KEY (customer_id) REFERENCES public.users(id)
        );

        CREATE TABLE analytics.weekly_stats (
          stats_id serial PRIMARY KEY,
          order_id bigint NOT NULL,
          order_line bigint NOT NULL,
          sales_amount numeric NOT NULL,
          FOREIGN KEY (order_id, order_line) REFERENCES sales.orders(order_id, line)
        );
      `
    }
  ];

  // Collect metadata across the different sources so snapshots reflect the expanded surface.
  const tables = snapshotTableMetadata(sources);
  expect(tables.map((table) => table.name)).toEqual([
    'analytics.weekly_stats',
    'public.users',
    'sales.orders'
  ]);

  // Ensure the composite primary-key columns remain marked not-null.
  const orders = tables.find((table) => table.name === 'sales.orders');
  expect(orders).toBeDefined();
  const nonNullOrders = orders!;
  expect(nonNullOrders.columns.filter((column) => !column.isNullable).map((column) => column.name)).toEqual([
    'order_id',
    'line',
    'customer_id',
    'total'
  ]);

  // Verify the stats table captures the cross-schema reference columns and their nullability.
  const stats = tables.find((table) => table.name === 'analytics.weekly_stats');
  expect(stats).toBeDefined();
  const nonNullStats = stats!;
  expect(nonNullStats.columns.map((column) => column.name)).toEqual([
    'stats_id',
    'order_id',
    'order_line',
    'sales_amount'
  ]);
  expect(nonNullStats.columns.slice(1, 3).every((column) => !column.isNullable)).toBe(true);

  // Normalize line endings so snapshots remain stable across platforms.
  const output = normalizeLineEndings(renderZtdConfigFile(tables));

  expect(output).toMatchSnapshot();
});
