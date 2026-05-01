import { serve } from '@hono/node-server';
import cluster from 'cluster';
import 'dotenv/config';
import { Hono } from 'hono';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';
import { pathToFileURL } from 'url';
import cpuUsage from './cpu-usage';

type QueryDefinition = {
  readonly name: string;
  readonly file: string;
};

type PreparedQuery = QueryDefinition & {
  readonly text: string;
};

type Row = Record<string, unknown>;

type RawsqlParserModule = {
  SelectQueryParser: {
    parse(sql: string): unknown;
  };
};

type StartOptions = {
  readonly validateRows: boolean;
};

const numCPUs = os.cpus().length;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: 10,
  max: 10,
});

const queryDefinitions = {
  customers: { name: 'rawsql_p1_customers', file: 'customers.sql' },
  customerById: { name: 'rawsql_p2_customer_by_id', file: 'customer-by-id.sql' },
  searchCustomer: { name: 'rawsql_p3_search_customer', file: 'search-customer.sql' },
  employees: { name: 'rawsql_p4_employees', file: 'employees.sql' },
  employeeWithRecipient: { name: 'rawsql_p5_employee_with_recipient', file: 'employee-with-recipient.sql' },
  suppliers: { name: 'rawsql_p6_suppliers', file: 'suppliers.sql' },
  supplierById: { name: 'rawsql_p7_supplier_by_id', file: 'supplier-by-id.sql' },
  products: { name: 'rawsql_p8_products', file: 'products.sql' },
  productWithSupplier: { name: 'rawsql_p9_product_with_supplier', file: 'product-with-supplier.sql' },
  searchProduct: { name: 'rawsql_p10_search_product', file: 'search-product.sql' },
  ordersWithDetails: { name: 'rawsql_p11_orders_with_details', file: 'orders-with-details.sql' },
  orderWithDetails: { name: 'rawsql_p12_order_with_details', file: 'order-with-details.sql' },
  orderWithDetailsAndProducts: {
    name: 'rawsql_p13_order_with_details_and_products',
    file: 'order-with-details-and-products.sql',
  },
} as const satisfies Record<string, QueryDefinition>;

const loadRawsqlParser = async (): Promise<RawsqlParserModule> => {
  const moduleName =
    process.env.RAWSQL_TS_IMPORT ?? pathToFileURL(path.resolve(__dirname, '../../../packages/core/src/index.ts')).href;
  return import(moduleName) as Promise<RawsqlParserModule>;
};

const loadQueries = async (): Promise<Record<keyof typeof queryDefinitions, PreparedQuery>> => {
  const { SelectQueryParser } = await loadRawsqlParser();
  const sqlDir = path.resolve(__dirname, '../sql');

  return Object.fromEntries(
    Object.entries(queryDefinitions).map(([key, definition]) => {
      const text = fs.readFileSync(path.join(sqlDir, definition.file), 'utf8');
      SelectQueryParser.parse(text);
      return [key, { ...definition, text }];
    }),
  ) as Record<keyof typeof queryDefinitions, PreparedQuery>;
};

const asNumber = (value: string | undefined): number => Number(value);
const asText = (value: string | undefined): string => String(value ?? '');
const searchTerm = (value: string | undefined): string => `${asText(value)}:*`;

const normalizeJson = <T>(value: T): T => value;

const validateObjectRows = (rows: unknown[]): void => {
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('Expected every result row to be an object');
    }
  }
};

const validateMaybeObject = (row: unknown): void => {
  if (row !== undefined && (row === null || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('Expected result row to be an object or undefined');
  }
};

const allRows = async <T>(query: PreparedQuery, values: readonly unknown[], validateRows: boolean): Promise<T[]> => {
  const result = await pool.query<T>({ name: query.name, text: query.text, values: [...values] });
  if (validateRows) {
    validateObjectRows(result.rows);
  }
  return normalizeJson(result.rows);
};

const firstRow = async <T>(
  query: PreparedQuery,
  values: readonly unknown[],
  validateRows: boolean,
): Promise<T | undefined> => {
  const result = await pool.query<T>({ name: query.name, text: query.text, values: [...values] });
  const row = result.rows[0];
  if (validateRows) {
    validateMaybeObject(row);
  }
  return normalizeJson(row);
};

const removeColumns = (row: Row, prefixes: readonly string[]): Row =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !prefixes.some((prefix) => key.startsWith(prefix))));

const prefixedObject = (row: Row, prefix: string, keys: readonly string[]): Row =>
  Object.fromEntries(keys.map((key) => [key, row[`${prefix}${key}`]]));

const mapEmployeeWithRecipient = (rows: Row[]): Row[] =>
  rows.map((row) => {
    const employee = removeColumns(row, ['recipient_']);
    return {
      ...employee,
      recipient:
        row.recipient_id === null
          ? null
          : prefixedObject(row, 'recipient_', [
              'id',
              'lastName',
              'firstName',
              'title',
              'titleOfCourtesy',
              'birthDate',
              'hireDate',
              'address',
              'city',
              'postalCode',
              'country',
              'homePhone',
              'extension',
              'notes',
              'recipientId',
            ]),
    };
  });

const mapProductWithSupplier = (rows: Row[]): Row[] =>
  rows.map((row) => ({
    ...removeColumns(row, ['supplier_']),
    supplier: prefixedObject(row, 'supplier_', [
      'id',
      'companyName',
      'contactName',
      'contactTitle',
      'address',
      'city',
      'region',
      'postalCode',
      'country',
      'phone',
    ]),
  }));

const mapOrderWithDetailsAndProducts = (rows: Row[]): Row[] => {
  const first = rows[0];
  if (!first) {
    return [];
  }

  const order = {
    ...removeColumns(first, ['detail_', 'product_']),
    details: rows
      .filter((row) => row.detail_orderId !== null)
      .map((row) => ({
        unitPrice: row.detail_unitPrice,
        quantity: row.detail_quantity,
        discount: row.detail_discount,
        orderId: row.detail_orderId,
        productId: row.detail_productId,
        product: prefixedObject(row, 'product_', [
          'id',
          'name',
          'quantityPerUnit',
          'unitPrice',
          'unitsInStock',
          'unitsOnOrder',
          'reorderLevel',
          'discontinued',
          'supplierId',
        ]),
      })),
  };

  return [order];
};

export const startRawsqlServer = async ({ validateRows }: StartOptions): Promise<void> => {
  const queries = await loadQueries();

  if (process.env.RAWSQL_BOOTSTRAP_ONLY === '1') {
    console.log(`rawsql-ts benchmark bootstrap loaded ${Object.keys(queries).length} prepared SQL files`);
    await pool.end();
    return;
  }

  const app = new Hono();

  app.route('', cpuUsage);

  app.get('/customers', async (c) => {
    const result = await allRows(queries.customers, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))], validateRows);
    return c.json(result);
  });

  app.get('/customer-by-id', async (c) => {
    const result = await firstRow(queries.customerById, [asText(c.req.query('id'))], validateRows);
    return c.json(result);
  });

  app.get('/search-customer', async (c) => {
    const result = await allRows(queries.searchCustomer, [searchTerm(c.req.query('term'))], validateRows);
    return c.json(result);
  });

  app.get('/employees', async (c) => {
    const result = await allRows(queries.employees, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))], validateRows);
    return c.json(result);
  });

  app.get('/employee-with-recipient', async (c) => {
    const rows = await allRows<Row>(queries.employeeWithRecipient, [asText(c.req.query('id'))], validateRows);
    const result = mapEmployeeWithRecipient(rows);
    return c.json(result);
  });

  app.get('/suppliers', async (c) => {
    const result = await allRows(queries.suppliers, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))], validateRows);
    return c.json(result);
  });

  app.get('/supplier-by-id', async (c) => {
    const result = await firstRow(queries.supplierById, [asText(c.req.query('id'))], validateRows);
    return c.json(result);
  });

  app.get('/products', async (c) => {
    const result = await allRows(queries.products, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))], validateRows);
    return c.json(result);
  });

  app.get('/product-with-supplier', async (c) => {
    const rows = await allRows<Row>(queries.productWithSupplier, [asText(c.req.query('id'))], validateRows);
    const result = mapProductWithSupplier(rows);
    return c.json(result);
  });

  app.get('/search-product', async (c) => {
    const result = await allRows(queries.searchProduct, [searchTerm(c.req.query('term'))], validateRows);
    return c.json(result);
  });

  app.get('/orders-with-details', async (c) => {
    const result = await allRows(
      queries.ordersWithDetails,
      [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))],
      validateRows,
    );
    return c.json(result);
  });

  app.get('/order-with-details', async (c) => {
    const result = await allRows(queries.orderWithDetails, [asText(c.req.query('id'))], validateRows);
    return c.json(result);
  });

  app.get('/order-with-details-and-products', async (c) => {
    const rows = await allRows<Row>(queries.orderWithDetailsAndProducts, [asText(c.req.query('id'))], validateRows);
    const result = mapOrderWithDetailsAndProducts(rows);
    return c.json(result);
  });

  if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork({
        ...process.env,
        RAWSQL_VALIDATE_ROWS: validateRows ? '1' : '0',
      });
    }

    cluster.on('exit', (worker) => {
      console.log(`worker ${worker.process.pid} died`);
    });
    return;
  }

  serve({
    fetch: app.fetch,
    port: 3000,
  });
  console.log(`Worker ${process.pid} started`);
};
