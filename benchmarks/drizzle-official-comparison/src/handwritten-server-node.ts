import { serve } from '@hono/node-server';
import cluster from 'cluster';
import 'dotenv/config';
import { Hono } from 'hono';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';
import cpuUsage from './cpu-usage';

type QueryDefinition = {
  readonly name: string;
  readonly file: string;
};

type PreparedQuery = QueryDefinition & {
  readonly text: string;
};

type Row = Record<string, unknown>;

const numCPUs = os.cpus().length;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: 10,
  max: 10,
});

const queryDefinitions = {
  customers: { name: 'handwritten_p1_customers', file: 'customers.sql' },
  customerById: { name: 'handwritten_p2_customer_by_id', file: 'customer-by-id.sql' },
  searchCustomer: { name: 'handwritten_p3_search_customer', file: 'search-customer.sql' },
  employees: { name: 'handwritten_p4_employees', file: 'employees.sql' },
  employeeWithRecipient: { name: 'handwritten_p5_employee_with_recipient', file: 'employee-with-recipient.sql' },
  suppliers: { name: 'handwritten_p6_suppliers', file: 'suppliers.sql' },
  supplierById: { name: 'handwritten_p7_supplier_by_id', file: 'supplier-by-id.sql' },
  products: { name: 'handwritten_p8_products', file: 'products.sql' },
  productWithSupplier: { name: 'handwritten_p9_product_with_supplier', file: 'product-with-supplier.sql' },
  searchProduct: { name: 'handwritten_p10_search_product', file: 'search-product.sql' },
  ordersWithDetails: { name: 'handwritten_p11_orders_with_details', file: 'orders-with-details.sql' },
  orderWithDetails: { name: 'handwritten_p12_order_with_details', file: 'order-with-details.sql' },
  orderWithDetailsAndProducts: {
    name: 'handwritten_p13_order_with_details_and_products',
    file: 'order-with-details-and-products.sql',
  },
} as const satisfies Record<string, QueryDefinition>;

type QueryKey = keyof typeof queryDefinitions;

const loadQueries = (): Record<QueryKey, PreparedQuery> => {
  const sqlDir = path.resolve(__dirname, '../sql');
  return Object.fromEntries(
    Object.entries(queryDefinitions).map(([key, definition]) => [
      key,
      {
        ...definition,
        text: fs.readFileSync(path.join(sqlDir, definition.file), 'utf8'),
      },
    ]),
  ) as Record<QueryKey, PreparedQuery>;
};

const asNumber = (value: string | undefined): number => Number(value);
const asText = (value: string | undefined): string => String(value ?? '');
const searchTerm = (value: string | undefined): string => `${asText(value)}:*`;

const allRows = async <T>(query: PreparedQuery, values: readonly unknown[]): Promise<T[]> => {
  const result = await pool.query<T>({ name: query.name, text: query.text, values: [...values] });
  return result.rows;
};

const firstRow = async <T>(query: PreparedQuery, values: readonly unknown[]): Promise<T | undefined> => {
  const result = await pool.query<T>({ name: query.name, text: query.text, values: [...values] });
  return result.rows[0];
};

const mapEmployeeWithRecipient = (rows: Row[]): Row[] =>
  rows.map((row) => ({
    id: row.id,
    lastName: row.lastName,
    firstName: row.firstName,
    title: row.title,
    titleOfCourtesy: row.titleOfCourtesy,
    birthDate: row.birthDate,
    hireDate: row.hireDate,
    address: row.address,
    city: row.city,
    postalCode: row.postalCode,
    country: row.country,
    homePhone: row.homePhone,
    extension: row.extension,
    notes: row.notes,
    recipientId: row.recipientId,
    recipient:
      row.recipient_id === null
        ? null
        : {
            id: row.recipient_id,
            lastName: row.recipient_lastName,
            firstName: row.recipient_firstName,
            title: row.recipient_title,
            titleOfCourtesy: row.recipient_titleOfCourtesy,
            birthDate: row.recipient_birthDate,
            hireDate: row.recipient_hireDate,
            address: row.recipient_address,
            city: row.recipient_city,
            postalCode: row.recipient_postalCode,
            country: row.recipient_country,
            homePhone: row.recipient_homePhone,
            extension: row.recipient_extension,
            notes: row.recipient_notes,
            recipientId: row.recipient_recipientId,
          },
  }));

const mapProductWithSupplier = (rows: Row[]): Row[] =>
  rows.map((row) => ({
    id: row.id,
    name: row.name,
    quantityPerUnit: row.quantityPerUnit,
    unitPrice: row.unitPrice,
    unitsInStock: row.unitsInStock,
    unitsOnOrder: row.unitsOnOrder,
    reorderLevel: row.reorderLevel,
    discontinued: row.discontinued,
    supplierId: row.supplierId,
    supplier: {
      id: row.supplier_id,
      companyName: row.supplier_companyName,
      contactName: row.supplier_contactName,
      contactTitle: row.supplier_contactTitle,
      address: row.supplier_address,
      city: row.supplier_city,
      region: row.supplier_region,
      postalCode: row.supplier_postalCode,
      country: row.supplier_country,
      phone: row.supplier_phone,
    },
  }));

const mapOrderWithDetailsAndProducts = (rows: Row[]): Row[] => {
  const first = rows[0];
  if (!first) {
    return [];
  }

  const details = [];
  for (const row of rows) {
    if (row.detail_orderId === null) {
      continue;
    }
    details.push({
      unitPrice: row.detail_unitPrice,
      quantity: row.detail_quantity,
      discount: row.detail_discount,
      orderId: row.detail_orderId,
      productId: row.detail_productId,
      product: {
        id: row.product_id,
        name: row.product_name,
        quantityPerUnit: row.product_quantityPerUnit,
        unitPrice: row.product_unitPrice,
        unitsInStock: row.product_unitsInStock,
        unitsOnOrder: row.product_unitsOnOrder,
        reorderLevel: row.product_reorderLevel,
        discontinued: row.product_discontinued,
        supplierId: row.product_supplierId,
      },
    });
  }

  return [
    {
      id: first.id,
      orderDate: first.orderDate,
      requiredDate: first.requiredDate,
      shippedDate: first.shippedDate,
      shipVia: first.shipVia,
      freight: first.freight,
      shipName: first.shipName,
      shipCity: first.shipCity,
      shipRegion: first.shipRegion,
      shipPostalCode: first.shipPostalCode,
      shipCountry: first.shipCountry,
      customerId: first.customerId,
      employeeId: first.employeeId,
      details,
    },
  ];
};

const startServer = async (): Promise<void> => {
  const queries = loadQueries();

  if (process.env.RAWSQL_BOOTSTRAP_ONLY === '1') {
    console.log(`handwritten benchmark bootstrap loaded ${Object.keys(queries).length} prepared SQL files`);
    await pool.end();
    return;
  }

  const app = new Hono();
  app.route('', cpuUsage);

  app.get('/customers', async (c) => {
    const result = await allRows(queries.customers, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))]);
    return c.json(result);
  });

  app.get('/customer-by-id', async (c) => {
    const result = await firstRow(queries.customerById, [asText(c.req.query('id'))]);
    if (result === undefined) {
      return c.json({ error: 'not found' }, 404);
    }
    return c.json(result);
  });

  app.get('/search-customer', async (c) => {
    const result = await allRows(queries.searchCustomer, [searchTerm(c.req.query('term'))]);
    return c.json(result);
  });

  app.get('/employees', async (c) => {
    const result = await allRows(queries.employees, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))]);
    return c.json(result);
  });

  app.get('/employee-with-recipient', async (c) => {
    const rows = await allRows<Row>(queries.employeeWithRecipient, [asText(c.req.query('id'))]);
    return c.json(mapEmployeeWithRecipient(rows));
  });

  app.get('/suppliers', async (c) => {
    const result = await allRows(queries.suppliers, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))]);
    return c.json(result);
  });

  app.get('/supplier-by-id', async (c) => {
    const result = await firstRow(queries.supplierById, [asText(c.req.query('id'))]);
    if (result === undefined) {
      return c.json({ error: 'not found' }, 404);
    }
    return c.json(result);
  });

  app.get('/products', async (c) => {
    const result = await allRows(queries.products, [asNumber(c.req.query('limit')), asNumber(c.req.query('offset'))]);
    return c.json(result);
  });

  app.get('/product-with-supplier', async (c) => {
    const rows = await allRows<Row>(queries.productWithSupplier, [asText(c.req.query('id'))]);
    return c.json(mapProductWithSupplier(rows));
  });

  app.get('/search-product', async (c) => {
    const result = await allRows(queries.searchProduct, [searchTerm(c.req.query('term'))]);
    return c.json(result);
  });

  app.get('/orders-with-details', async (c) => {
    const result = await allRows(queries.ordersWithDetails, [
      asNumber(c.req.query('limit')),
      asNumber(c.req.query('offset')),
    ]);
    return c.json(result);
  });

  app.get('/order-with-details', async (c) => {
    const result = await allRows(queries.orderWithDetails, [asText(c.req.query('id'))]);
    return c.json(result);
  });

  app.get('/order-with-details-and-products', async (c) => {
    const rows = await allRows<Row>(queries.orderWithDetailsAndProducts, [asText(c.req.query('id'))]);
    return c.json(mapOrderWithDetailsAndProducts(rows));
  });

  if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
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

void startServer();
