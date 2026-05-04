import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { relations } from '../src/relations';
import type { Row } from '../src/local/sql-contract-mapper';
import type { PreparedQuery, QueryCatalog } from '../src/rfba/features/_shared/queryCatalog';
import { loadQueryCatalog } from '../src/rfba/features/_shared/queryCatalog';
import type { FeatureQueryExecutor } from '../src/rfba/features/_shared/featureQueryExecutor';
import { executeListProductsEntrySpec } from '../src/rfba/features/list-products/boundary';
import { executeGetProductWithSupplierEntrySpec } from '../src/rfba/features/get-product-with-supplier/boundary';
import { executeGetOrderWithDetailsAndProductsEntrySpec } from '../src/rfba/features/get-order-with-details-and-products/boundary';
import { mapProductWithSupplierRowsToResult } from '../src/rfba/features/get-product-with-supplier/generated/row-mapper';
import { mapOrderWithDetailsAndProductsRowsToResult } from '../src/rfba/features/get-order-with-details-and-products/generated/row-mapper';

type Target = 'handwritten' | 'drizzle' | 'rfba';
type Phase =
  | 'db-query-only'
  | 'db-query-mapper'
  | 'mapper-only'
  | 'mapper-json'
  | 'executor-only-direct'
  | 'executor-only-rfba'
  | 'executor-only-rfba-fast'
  | 'params-handwritten'
  | 'params-rfba-boundary'
  | 'params-rfba-executor'
  | 'call-chain-direct'
  | 'call-chain-rfba-boundary'
  | 'call-chain-rfba-fast'
  | 'aggregation-handwritten'
  | 'aggregation-rfba-current'
  | 'aggregation-rfba-optimized';
type CaseName = 'products' | 'productWithSupplier' | 'orderWithDetailsAndProducts';

type Args = {
  runs: number;
  iterations: number;
  warmup: number;
  targets: Target[];
  folder: string;
};

type CaseDefinition = {
  readonly name: CaseName;
  readonly handwrittenKey: keyof typeof handwrittenQueryDefinitions;
  readonly params: (fixture: FixtureIds) => readonly unknown[];
};

type FixtureIds = {
  productId: string;
  orderId: string;
};

type TimedResult = {
  target: Target;
  phase: Phase;
  case: CaseName;
  run: number;
  iterations: number;
  opsPerSec: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

type QueryLike = {
  text: string;
  values?: unknown[];
  name?: string;
};

const handwrittenQueryDefinitions = {
  products: { name: 'pure_handwritten_products', file: 'products.sql' },
  productWithSupplier: { name: 'pure_handwritten_product_with_supplier', file: 'product-with-supplier.sql' },
  orderWithDetailsAndProducts: {
    name: 'pure_handwritten_order_with_details_and_products',
    file: 'order-with-details-and-products.sql',
  },
} as const;

const cases: CaseDefinition[] = [
  {
    name: 'products',
    handwrittenKey: 'products',
    params: () => [10, 0],
  },
  {
    name: 'productWithSupplier',
    handwrittenKey: 'productWithSupplier',
    params: (fixture) => [fixture.productId],
  },
  {
    name: 'orderWithDetailsAndProducts',
    handwrittenKey: 'orderWithDetailsAndProducts',
    params: (fixture) => [fixture.orderId],
  },
];

const parseArgs = (): Args => {
  const options = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    options.set(key, value);
  }

  const targets = (options.get('targets') ?? 'handwritten,drizzle,rfba')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as Target[];

  return {
    runs: Number(options.get('runs') ?? 3),
    iterations: Number(options.get('iterations') ?? 500),
    warmup: Number(options.get('warmup') ?? 50),
    targets,
    folder: options.get('folder') ?? 'results-pure-orm',
  };
};

const createPool = (): pg.Pool =>
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    min: Number(process.env.RAWSQL_PG_POOL_MIN ?? 10),
    max: Number(process.env.RAWSQL_PG_POOL_MAX ?? 10),
  });

const percentile = (values: number[], percentileValue: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
};

const timed = async (iterations: number, operation: () => Promise<unknown> | unknown): Promise<Omit<TimedResult, 'target' | 'phase' | 'case' | 'run' | 'iterations'>> => {
  const samples: number[] = [];
  const totalStart = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await operation();
    samples.push(performance.now() - start);
  }
  const totalMs = performance.now() - totalStart;
  const sum = samples.reduce((acc, value) => acc + value, 0);
  return {
    opsPerSec: (iterations / totalMs) * 1000,
    meanMs: sum / samples.length,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
  };
};

const rotateTargets = (targets: Target[], runIndex: number): Target[] => {
  const offset = runIndex % targets.length;
  return [...targets.slice(offset), ...targets.slice(0, offset)];
};

const loadHandwrittenQueries = (): Record<keyof typeof handwrittenQueryDefinitions, PreparedQuery> => {
  const sqlDir = path.resolve(__dirname, '../sql');
  return Object.fromEntries(
    Object.entries(handwrittenQueryDefinitions).map(([key, definition]) => [
      key,
      {
        ...definition,
        text: fs.readFileSync(path.join(sqlDir, definition.file), 'utf8'),
      },
    ]),
  ) as Record<keyof typeof handwrittenQueryDefinitions, PreparedQuery>;
};

const queryRows = async (pool: pg.Pool, query: PreparedQuery, values: readonly unknown[]): Promise<Row[]> => {
  const result = await pool.query({
    name: query.name,
    text: query.text,
    values: values as unknown[],
  });
  return result.rows;
};

const executeRfbaRows = (pool: pg.Pool): FeatureQueryExecutor => ({
  executeRows: async (query, values = []) => {
    const result = await pool.query({ name: query.name, text: query.text, values: values as unknown[] });
    return result.rows;
  },
  execute: async (query, values = []) => {
    const result = await pool.query({ name: query.name, text: query.text, values: values as unknown[] });
    return { rows: result.rows, rowCount: result.rowCount ?? undefined };
  },
});

const mapProducts = (rows: Row[]): Row[] => rows;

const mapHandwrittenProductWithSupplierRows = (rows: Row[]): Row[] =>
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

const mapHandwrittenOrderWithDetailsAndProductsRows = (rows: Row[]): Row[] => {
  const first = rows[0];
  if (!first) {
    return [];
  }

  const detailsResult = [];
  for (const row of rows) {
    if (row.detail_orderId === null) {
      continue;
    }
    detailsResult.push({
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
      details: detailsResult,
    },
  ];
};

const mapRfbaOrderWithDetailsAndProductsRowsCurrent = (rows: Row[]): Row[] => {
  const first = rows[0];
  if (!first) {
    return [];
  }

  const mapOrderRow = (row: Row) => ({
    id: row.id as number,
    orderDate: row.orderDate as string,
    requiredDate: row.requiredDate as string,
    shippedDate: row.shippedDate as string | null,
    shipVia: row.shipVia as number,
    freight: row.freight as number,
    shipName: row.shipName as string,
    shipCity: row.shipCity as string,
    shipRegion: row.shipRegion as string | null,
    shipPostalCode: row.shipPostalCode as string | null,
    shipCountry: row.shipCountry as string,
    customerId: row.customerId as number,
    employeeId: row.employeeId as number,
  });

  const mapProductRow = (row: Row) => ({
    id: row.product_id as number,
    name: row.product_name as string,
    quantityPerUnit: row.product_quantityPerUnit as string,
    unitPrice: row.product_unitPrice as number,
    unitsInStock: row.product_unitsInStock as number,
    unitsOnOrder: row.product_unitsOnOrder as number,
    reorderLevel: row.product_reorderLevel as number,
    discontinued: row.product_discontinued as number,
    supplierId: row.product_supplierId as number,
  });

  const mapDetailRow = (row: Row) => ({
    unitPrice: row.detail_unitPrice as number,
    quantity: row.detail_quantity as number,
    discount: row.detail_discount as number,
    orderId: row.detail_orderId as number,
    productId: row.detail_productId as number,
  });

  const details = [];
  for (const row of rows) {
    if (row.detail_orderId === null) {
      continue;
    }
    details.push({
      ...mapDetailRow(row),
      product: mapProductRow(row),
    });
  }

  return [{ ...mapOrderRow(first), details }];
};

const handwrittenMapper = (caseName: CaseName, rows: Row[]): unknown => {
  if (caseName === 'productWithSupplier') {
    return mapHandwrittenProductWithSupplierRows(rows);
  }
  if (caseName === 'orderWithDetailsAndProducts') {
    return mapHandwrittenOrderWithDetailsAndProductsRows(rows);
  }
  return mapProducts(rows);
};

const rfbaMapper = (caseName: CaseName, rows: Row[]): unknown => {
  if (caseName === 'productWithSupplier') {
    return mapProductWithSupplierRowsToResult(rows);
  }
  if (caseName === 'orderWithDetailsAndProducts') {
    return mapOrderWithDetailsAndProductsRowsToResult(rows);
  }
  return mapProducts(rows);
};

const makeHandwrittenParams = (caseName: CaseName, fixture: FixtureIds): readonly unknown[] => {
  if (caseName === 'products') {
    return [10, 0];
  }
  if (caseName === 'productWithSupplier') {
    return [fixture.productId];
  }
  return [fixture.orderId];
};

const makeRfbaBoundaryParams = (caseName: CaseName, fixture: FixtureIds): readonly unknown[] => {
  if (caseName === 'products') {
    const limit = 10;
    const offset = 0;
    return [limit, offset];
  }
  if (caseName === 'productWithSupplier') {
    const id = fixture.productId;
    return [id];
  }
  const id = fixture.orderId;
  return [id];
};

const makeRfbaExecutorParams = (values: readonly unknown[]): unknown[] => values as unknown[];

const directCallChain = (query: PreparedQuery, values: readonly unknown[]): number => query.name.length + values.length;

const rfbaBoundaryCallChain = (query: PreparedQuery, values: readonly unknown[]): number => {
  const executor: FeatureQueryExecutor = {
    executeRows: async () => [],
    execute: async () => ({ rows: [] }),
  };
  const useExecutor = (nextQuery: PreparedQuery, nextValues: readonly unknown[]): number =>
    Number(Boolean(executor.executeRows)) + nextQuery.name.length + nextValues.length;
  return useExecutor(query, values);
};

const rfbaFastCallChain = (query: PreparedQuery, values: readonly unknown[]): number => query.name.length + values.length;

const prepareDrizzleQueries = (client: unknown) => {
  const db = drizzle({ client: client as pg.Pool, relations, useJitMappers: true });
  const productsQuery = db.query.products
    .findMany({
      limit: sql.placeholder('limit'),
      offset: sql.placeholder('offset'),
      orderBy: {
        id: 'asc',
      },
    })
    .prepare('pure_drizzle_products');

  const productWithSupplierQuery = db.query.products
    .findMany({
      where: {
        id: sql.placeholder('id'),
      },
      with: {
        supplier: true,
      },
    })
    .prepare('pure_drizzle_product_with_supplier');

  const orderWithDetailsAndProductsQuery = db.query.orders
    .findMany({
      with: {
        details: {
          with: {
            product: true,
          },
        },
      },
      where: {
        id: sql.placeholder('id'),
      },
    })
    .prepare('pure_drizzle_order_with_details_and_products');

  return {
    products: productsQuery,
    productWithSupplier: productWithSupplierQuery,
    orderWithDetailsAndProducts: orderWithDetailsAndProductsQuery,
  };
};

class CaptureClient {
  public readonly captured = new Map<CaseName, QueryLike>();
  public readonly capturedRows = new Map<CaseName, Row[]>();
  private mode: 'capture' | 'fixture' = 'capture';
  private activeCase: CaseName = 'products';
  private readonly fixtures = new Map<CaseName, Row[]>();

  constructor(private readonly delegate: pg.Pool) {}

  setCase(caseName: CaseName): void {
    this.activeCase = caseName;
  }

  setFixtureMode(fixtures: Map<CaseName, Row[]>): void {
    this.mode = 'fixture';
    this.fixtures.clear();
    for (const [caseName, rows] of fixtures) {
      this.fixtures.set(caseName, rows);
    }
  }

  async query(query: QueryLike | string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number }> {
    if (this.mode === 'fixture') {
      const rows = this.fixtures.get(this.activeCase) ?? [];
      return { rows, rowCount: rows.length };
    }

    const normalized = typeof query === 'string' ? { text: query, values } : { ...query, values: values ?? query.values };
    this.captured.set(this.activeCase, normalized);
    const result = await this.delegate.query(normalized as pg.QueryConfig);
    this.capturedRows.set(this.activeCase, result.rows);
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  }
}

const drizzleParams = (caseName: CaseName, fixture: FixtureIds): Record<string, unknown> => {
  if (caseName === 'products') {
    return { limit: 10, offset: 0 };
  }
  if (caseName === 'productWithSupplier') {
    return { id: fixture.productId };
  }
  return { id: fixture.orderId };
};

const runTarget = async (
  target: Target,
  run: number,
  args: Args,
  fixture: FixtureIds,
  fixtureRows: Map<CaseName, Row[]>,
): Promise<TimedResult[]> => {
  const pool = createPool();
  const results: TimedResult[] = [];

  try {
    if (target === 'handwritten') {
      const queries = loadHandwrittenQueries();
      for (const caseDefinition of cases) {
        const values = caseDefinition.params(fixture);
        const query = queries[caseDefinition.handwrittenKey];
        const dbOnly = () => queryRows(pool, query, values).then((rows) => rows.length);
        const dbMapper = () => queryRows(pool, query, values).then((rows) => handwrittenMapper(caseDefinition.name, rows));
        const mapperOnly = () => handwrittenMapper(caseDefinition.name, fixtureRows.get(caseDefinition.name) ?? []);
        const mapperJson = () => JSON.stringify(handwrittenMapper(caseDefinition.name, fixtureRows.get(caseDefinition.name) ?? []));
        const extraOperations: [Phase, () => Promise<unknown> | unknown][] = [
          ['executor-only-direct', dbOnly],
          ['params-handwritten', () => makeHandwrittenParams(caseDefinition.name, fixture)],
          ['call-chain-direct', () => directCallChain(query, values)],
        ];
        if (caseDefinition.name === 'orderWithDetailsAndProducts') {
          const orderRows = fixtureRows.get(caseDefinition.name) ?? [];
          extraOperations.push(['aggregation-handwritten', () => mapHandwrittenOrderWithDetailsAndProductsRows(orderRows)]);
        }
        results.push(
          ...(await measureCase(
            target,
            run,
            args,
            caseDefinition.name,
            dbOnly,
            dbMapper,
            mapperOnly,
            mapperJson,
            extraOperations,
          )),
        );
      }
      return results;
    }

    if (target === 'rfba') {
      const catalog = await loadQueryCatalog();
      const executor = executeRfbaRows(pool);
      for (const caseDefinition of cases) {
        const values = caseDefinition.params(fixture);
        const query = catalog[caseDefinition.handwrittenKey as keyof QueryCatalog];
        const dbOnly = () => executor.executeRows!(query, values).then((rows) => rows.length);
        const dbMapper = () => {
          if (caseDefinition.name === 'products') {
            return executeListProductsEntrySpec(executor, catalog, 10, 0);
          }
          if (caseDefinition.name === 'productWithSupplier') {
            return executeGetProductWithSupplierEntrySpec(executor, catalog, fixture.productId);
          }
          return executeGetOrderWithDetailsAndProductsEntrySpec(executor, catalog, fixture.orderId);
        };
        const mapperOnly = () => rfbaMapper(caseDefinition.name, fixtureRows.get(caseDefinition.name) ?? []);
        const mapperJson = () => JSON.stringify(rfbaMapper(caseDefinition.name, fixtureRows.get(caseDefinition.name) ?? []));
        const rfbaFastDbOnly = () => queryRows(pool, query, values).then((rows) => rows.length);
        const extraOperations: [Phase, () => Promise<unknown> | unknown][] = [
          ['executor-only-rfba', dbOnly],
          ['executor-only-rfba-fast', rfbaFastDbOnly],
          ['params-rfba-boundary', () => makeRfbaBoundaryParams(caseDefinition.name, fixture)],
          ['params-rfba-executor', () => makeRfbaExecutorParams(values)],
          ['call-chain-rfba-boundary', () => rfbaBoundaryCallChain(query, values)],
          ['call-chain-rfba-fast', () => rfbaFastCallChain(query, values)],
        ];
        if (caseDefinition.name === 'orderWithDetailsAndProducts') {
          const orderRows = fixtureRows.get(caseDefinition.name) ?? [];
          extraOperations.push(
            ['aggregation-rfba-current', () => mapRfbaOrderWithDetailsAndProductsRowsCurrent(orderRows)],
            ['aggregation-rfba-optimized', () => mapOrderWithDetailsAndProductsRowsToResult(orderRows)],
          );
        }
        results.push(
          ...(await measureCase(
            target,
            run,
            args,
            caseDefinition.name,
            dbOnly,
            dbMapper,
            mapperOnly,
            mapperJson,
            extraOperations,
          )),
        );
      }
      return results;
    }

    const captureClient = new CaptureClient(pool);
    const captureQueries = prepareDrizzleQueries(captureClient);
    for (const caseDefinition of cases) {
      captureClient.setCase(caseDefinition.name);
      await captureQueries[caseDefinition.name].execute(drizzleParams(caseDefinition.name, fixture));
    }

    const realQueries = prepareDrizzleQueries(pool);
    captureClient.setFixtureMode(captureClient.capturedRows);
    const fixtureQueries = prepareDrizzleQueries(captureClient);

    for (const caseDefinition of cases) {
      const captured = captureClient.captured.get(caseDefinition.name);
      if (!captured) {
        throw new Error(`Could not capture Drizzle SQL for ${caseDefinition.name}`);
      }
      const drizzleValues = drizzleParams(caseDefinition.name, fixture);
      const dbOnly = () => pool.query(captured as pg.QueryConfig).then((result) => result.rows.length);
      const dbMapper = () => realQueries[caseDefinition.name].execute(drizzleValues);
      const mapperOnly = () => {
        captureClient.setCase(caseDefinition.name);
        return fixtureQueries[caseDefinition.name].execute(drizzleValues);
      };
      const mapperJson = async () => JSON.stringify(await mapperOnly());
      results.push(...(await measureCase(target, run, args, caseDefinition.name, dbOnly, dbMapper, mapperOnly, mapperJson)));
    }

    return results;
  } finally {
    await pool.end();
  }
};

const measureCase = async (
  target: Target,
  run: number,
  args: Args,
  caseName: CaseName,
  dbOnly: () => Promise<unknown> | unknown,
  dbMapper: () => Promise<unknown> | unknown,
  mapperOnly: () => Promise<unknown> | unknown,
  mapperJson: () => Promise<unknown> | unknown,
  extraOperations: [Phase, () => Promise<unknown> | unknown][] = [],
): Promise<TimedResult[]> => {
  const operations: [Phase, () => Promise<unknown> | unknown][] = [
    ['db-query-only', dbOnly],
    ['db-query-mapper', dbMapper],
    ['mapper-only', mapperOnly],
    ['mapper-json', mapperJson],
    ...extraOperations,
  ];
  const results: TimedResult[] = [];

  for (const [phase, operation] of operations) {
    for (let index = 0; index < args.warmup; index += 1) {
      await operation();
    }
    const measured = await timed(args.iterations, operation);
    results.push({
      target,
      phase,
      case: caseName,
      run,
      iterations: args.iterations,
      ...measured,
    });
  }

  return results;
};

const loadFixture = async (pool: pg.Pool): Promise<{ ids: FixtureIds; rows: Map<CaseName, Row[]> }> => {
  const productIdResult = await pool.query<{ id: number }>('select id from products order by id limit 1');
  const orderIdResult = await pool.query<{ id: number }>(
    'select o.id from orders o where exists (select 1 from order_details d where d.order_id = o.id) order by o.id limit 1',
  );
  const ids = {
    productId: String(productIdResult.rows[0]?.id ?? 1),
    orderId: String(orderIdResult.rows[0]?.id ?? 1),
  };
  const queries = loadHandwrittenQueries();
  const rows = new Map<CaseName, Row[]>();
  for (const caseDefinition of cases) {
    rows.set(caseDefinition.name, await queryRows(pool, queries[caseDefinition.handwrittenKey], caseDefinition.params(ids)));
  }
  return { ids, rows };
};

const summarize = (results: TimedResult[]) => {
  const groups = new Map<string, TimedResult[]>();
  for (const result of results) {
    const key = `${result.target}:${result.phase}:${result.case}`;
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]) => {
    const [target, phase, caseName] = key.split(':') as [Target, Phase, CaseName];
    const ops = group.map((value) => value.opsPerSec);
    const p50 = group.map((value) => value.p50Ms);
    const p95 = group.map((value) => value.p95Ms);
    const p99 = group.map((value) => value.p99Ms);
    return {
      target,
      phase,
      case: caseName,
      runs: group.length,
      opsPerSecAvg: ops.reduce((acc, value) => acc + value, 0) / ops.length,
      opsPerSecMedian: percentile(ops, 50),
      p50MsMedian: percentile(p50, 50),
      p95MsMedian: percentile(p95, 50),
      p99MsMedian: percentile(p99, 50),
    };
  });
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const outputDir = path.resolve(process.cwd(), args.folder);
  fs.mkdirSync(outputDir, { recursive: true });

  const fixturePool = createPool();
  const fixture = await loadFixture(fixturePool);
  await fixturePool.end();

  const results: TimedResult[] = [];
  for (let run = 1; run <= args.runs; run += 1) {
    const order = rotateTargets(args.targets, run - 1);
    console.log(`[pure-orm] run=${run} order=${order.join(',')}`);
    for (const target of order) {
      console.log(`[pure-orm] target=${target} run=${run}`);
      results.push(...(await runTarget(target, run, args, fixture.ids, fixture.rows)));
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: process.argv.join(' '),
    config: {
      runs: args.runs,
      iterations: args.iterations,
      warmup: args.warmup,
      targets: args.targets,
      pool: {
        min: Number(process.env.RAWSQL_PG_POOL_MIN ?? 10),
        max: Number(process.env.RAWSQL_PG_POOL_MAX ?? 10),
      },
      fixtureIds: fixture.ids,
      cases: cases.map((value) => value.name),
    },
    notes: [
      'db-query-only uses direct pg execution for handwritten/rawsql SQL and captured Drizzle-generated SQL for Drizzle.',
      'db-query-mapper uses each target natural query path: Drizzle prepared query with JIT mapper, RFBA boundary with AOT mapper, and handwritten direct mapper.',
      'mapper-only and mapper-json use fixture rows without DB round trips.',
      'executor-only, params, call-chain, and aggregation phases are diagnostic breakdowns for rawsql-ts RFBA + AOT overhead investigation.',
    ],
    summary: summarize(results),
    results,
  };

  const outputPath = path.join(outputDir, 'pure-orm-summary.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[pure-orm] wrote ${outputPath}`);
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
