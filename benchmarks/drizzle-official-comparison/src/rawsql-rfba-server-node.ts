import { serve } from '@hono/node-server';
import cluster from 'cluster';
import 'dotenv/config';
import { Hono } from 'hono';
import os from 'os';
import cpuUsage from './cpu-usage';
import { executePrepared } from './rfba/adapters/pg/prepared-query-executor';
import { pool } from './rfba/adapters/pg/pool';
import type { FeatureQueryExecutor } from './rfba/features/_shared/featureQueryExecutor';
import { loadQueryCatalog } from './rfba/features/_shared/queryCatalog';
import { executeGetCustomerByIdEntrySpec } from './rfba/features/get-customer-by-id/boundary';
import { executeGetEmployeeWithRecipientEntrySpec } from './rfba/features/get-employee-with-recipient/boundary';
import { executeGetOrderWithDetailsEntrySpec } from './rfba/features/get-order-with-details/boundary';
import { executeGetOrderWithDetailsAndProductsEntrySpec } from './rfba/features/get-order-with-details-and-products/boundary';
import { executeGetProductWithSupplierEntrySpec } from './rfba/features/get-product-with-supplier/boundary';
import { executeGetSupplierByIdEntrySpec } from './rfba/features/get-supplier-by-id/boundary';
import { executeListCustomersEntrySpec } from './rfba/features/list-customers/boundary';
import { executeListEmployeesEntrySpec } from './rfba/features/list-employees/boundary';
import { executeListOrdersWithDetailsEntrySpec } from './rfba/features/list-orders-with-details/boundary';
import { executeListProductsEntrySpec } from './rfba/features/list-products/boundary';
import { executeListSuppliersEntrySpec } from './rfba/features/list-suppliers/boundary';
import { executeSearchCustomerEntrySpec } from './rfba/features/search-customer/boundary';
import { executeSearchProductEntrySpec } from './rfba/features/search-product/boundary';

const numCPUs = os.cpus().length;

const asNumber = (value: string | undefined): number => Number(value);
const asText = (value: string | undefined): string => String(value ?? '');

const startServer = async (): Promise<void> => {
  const queries = await loadQueryCatalog();
  const executor: FeatureQueryExecutor = {
    execute: executePrepared,
  };

  if (process.env.RAWSQL_BOOTSTRAP_ONLY === '1') {
    console.log(`rawsql-ts RFBA benchmark bootstrap loaded ${Object.keys(queries).length} prepared SQL files`);
    await pool.end();
    return;
  }

  const app = new Hono();
  app.route('', cpuUsage);

  app.get('/customers', async (c) => {
    const result = await executeListCustomersEntrySpec(
      executor,
      queries,
      asNumber(c.req.query('limit')),
      asNumber(c.req.query('offset')),
    );
    return c.json(result);
  });

  app.get('/customer-by-id', async (c) => {
    const result = await executeGetCustomerByIdEntrySpec(executor, queries, asText(c.req.query('id')));
    return c.json(result);
  });

  app.get('/search-customer', async (c) => {
    const result = await executeSearchCustomerEntrySpec(executor, queries, asText(c.req.query('term')));
    return c.json(result);
  });

  app.get('/employees', async (c) => {
    const result = await executeListEmployeesEntrySpec(
      executor,
      queries,
      asNumber(c.req.query('limit')),
      asNumber(c.req.query('offset')),
    );
    return c.json(result);
  });

  app.get('/employee-with-recipient', async (c) => {
    const result = await executeGetEmployeeWithRecipientEntrySpec(executor, queries, asText(c.req.query('id')));
    return c.json(result);
  });

  app.get('/suppliers', async (c) => {
    const result = await executeListSuppliersEntrySpec(
      executor,
      queries,
      asNumber(c.req.query('limit')),
      asNumber(c.req.query('offset')),
    );
    return c.json(result);
  });

  app.get('/supplier-by-id', async (c) => {
    const result = await executeGetSupplierByIdEntrySpec(executor, queries, asText(c.req.query('id')));
    return c.json(result);
  });

  app.get('/products', async (c) => {
    const result = await executeListProductsEntrySpec(
      executor,
      queries,
      asNumber(c.req.query('limit')),
      asNumber(c.req.query('offset')),
    );
    return c.json(result);
  });

  app.get('/product-with-supplier', async (c) => {
    const result = await executeGetProductWithSupplierEntrySpec(executor, queries, asText(c.req.query('id')));
    return c.json(result);
  });

  app.get('/search-product', async (c) => {
    const result = await executeSearchProductEntrySpec(executor, queries, asText(c.req.query('term')));
    return c.json(result);
  });

  app.get('/orders-with-details', async (c) => {
    const result = await executeListOrdersWithDetailsEntrySpec(
      executor,
      queries,
      asNumber(c.req.query('limit')),
      asNumber(c.req.query('offset')),
    );
    return c.json(result);
  });

  app.get('/order-with-details', async (c) => {
    const result = await executeGetOrderWithDetailsEntrySpec(executor, queries, asText(c.req.query('id')));
    return c.json(result);
  });

  app.get('/order-with-details-and-products', async (c) => {
    const result = await executeGetOrderWithDetailsAndProductsEntrySpec(executor, queries, asText(c.req.query('id')));
    return c.json(result);
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
